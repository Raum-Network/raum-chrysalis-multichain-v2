import { useState, useEffect } from 'react';
import { useWallet } from '../lib/walletConnect';
import { useStaking, StakingReceipt } from '../hooks/useStaking';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import Button from '../components/Button';
import Window from '../components/Window';
import AmountInput from '../components/AmountInput';
import { Progress } from '../components/Progress';
import { ArrowRightLeft, Loader2, ChevronRight, CheckCircle2, XCircle, X, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUPPORTED_NETWORKS } from '../config/contract';
import { getLidoAPY } from '../services/api';
import ReactGA from 'react-ga4';
import { ConnectKitButton } from 'connectkit';

const Stake = () => {
  const { isConnected, networkConfig, address } = useWallet();
  const { stake, stakeStatus, isStaking, bridgeProtocol, setBridgeProtocol, checkAllowance, isApproving, usdcBalance, linkBalance, xrpBalance, stakingNFTs, stakingOffers } = useStaking();
  const [stakeAmount, setStakeAmount] = useState(0);
  const [hasAllowance, setHasAllowance] = useState(false);
  const [stakeView, setStakeView] = useState<'form' | 'confirming' | 'success'>('form');
  const [error, setError] = useState<string | null>(null);
  const [currentStake, setCurrentStake] = useState<StakeStatus | null>(null);
  const [showTransactionBox, setShowTransactionBox] = useState(false);
  const [showSuccessDelay, setShowSuccessDelay] = useState(false);
  const [lidoAPY, setLidoAPY] = useState<number | null>(null);
  const [expandedNFT, setExpandedNFT] = useState<string | null>(null);

  const getExplorerUrl = (txHash: string) => {
    const network = Object.values(SUPPORTED_NETWORKS).find(net => net.chainId === networkConfig.chainId);
    if (!network) return `https://sepolia.arbiscan.io/tx/${txHash}`;

    switch (network.name.toLowerCase()) {
      case 'arbitrum sepolia':
        return `https://sepolia.arbiscan.io/tx/${txHash}`;
      case 'base sepolia':
        return `https://sepolia.basescan.org/tx/${txHash}`;
      case 'lisk sepolia':
        return `https://sepolia-blockscout.lisk.com/tx/${txHash}`;
      case 'polygon amoy':
        return `https://www.oklink.com/amoy/tx/${txHash}`;
      case 'plume testnet':
        return `https://testnet-explorer.plume.org/tx/${txHash}`;
      case 'ripple testnet':
        return `https://testnet.axelarscan.io/gmp/${txHash}`;
      default:
        return `https://sepolia.arbiscan.io/tx/${txHash}`;
    }
  };

  // Check allowance whenever stakeAmount changes
  useEffect(() => {
    const checkAllowanceStatus = async () => {
      if (stakeAmount > 0) {
        const hasAllowance = await checkAllowance(stakeAmount);
        setHasAllowance(hasAllowance);
      } else {
        setHasAllowance(false);
      }
    };
    checkAllowanceStatus();
  }, [stakeAmount, checkAllowance]);

  // Subscribe to StakeManager updates
  useEffect(() => {
    const handleStatusUpdate = (status: StakeStatus) => {
      setCurrentStake(status);
      setShowTransactionBox(true);

      if (status.status === 'SUCCESS') {

        if (bridgeProtocol === 'CCTP') {
          setTimeout(() => {
            setShowSuccessDelay(true);
            setStakeView('success');
          }, 30000); // 30 seconds delay
        } else {
          setStakeView('success');
        }
      }
    };

    const unsubscribe = stakeManager.subscribeToStatus(handleStatusUpdate);
    return () => unsubscribe();
  }, [bridgeProtocol]);

  useEffect(() => {

    if (address) {
      ReactGA.event({
        category: 'Wallet',
        action: 'Click',
        label: `Connected Wallet ${address}`
      });
    }
  }, [address])

  useEffect(() => {
    const fetchLidoAPY = async () => {
      try {
        const apy = await getLidoAPY();
        setLidoAPY(apy);
      } catch (error) {
        console.error('Error fetching Lido APY:', error);
      }
    };

    fetchLidoAPY();
    const interval = setInterval(fetchLidoAPY, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleStakeSubmit = async () => {
    if (stakeAmount <= 0) return;
    setError(null);

    try {
      ReactGA.event({
        category: 'Social Links',
        action: 'Click',
        label: `Staking USDC ${address} on ${networkConfig.name} using ${bridgeProtocol}`,
      });
      await stake(stakeAmount, lidoAPY ? lidoAPY.toFixed(2) : undefined);
    } catch (error) {
      console.error('Staking failed:', error);
      setError('Transaction failed. Please try again.');
    }
  };

  const handleClearError = () => {
    setError(null);
  };

  const resetForm = () => {
    setStakeAmount(0);
    setStakeView('form');
    setError(null);
    setCurrentStake(null);
    setShowTransactionBox(false);
    setShowSuccessDelay(false); // Reset the delay state
  };

  const renderProtocolSelector = () => {
    if (networkConfig.name === 'Ripple Testnet') {
      return (
        <div className="mb-4">
          <button
            className="p-3 rounded-md border border-amber-500 bg-amber-900/30 shadow-lg shadow-amber-900/20 w-full"
            onClick={() => setBridgeProtocol("Axelar ITS")}
          >
            <div className="flex flex-col items-center space-y-2">
              <span className="text-sm font-medium">Axelar ITS</span>
              <span className="text-xs opacity-70">Interchain Token Service</span>
            </div>
          </button>
        </div>
      );
    }

    // For Base Sepolia and Lisk Sepolia, only show CCIP
    if (networkConfig.name === 'Base Sepolia' || networkConfig.name === 'Lisk Sepolia' || networkConfig.name === 'Plume Testnet') {
      return (
        <div className="mb-4">
          <button
            className="p-3 rounded-md border border-amber-500 bg-amber-900/30 shadow-lg shadow-amber-900/20 w-full"
            onClick={() => setBridgeProtocol("CCIP")}
          >
            <div className="flex flex-col items-center space-y-2">
              <span className="text-sm font-medium">Chainlink CCIP</span>
              <span className="text-xs opacity-70">Cross-Chain Interoperability Protocol</span>
            </div>
          </button>
        </div>
      );
    }

    // For other networks, show both CCIP and CCTP
    return (
      <div className="grid grid-cols-2 gap-4 mb-4">
        {['CCIP', 'CCTP'].map((protocol) => (
          <button
            key={protocol}
            onClick={() => setBridgeProtocol(protocol as "CCIP" | "CCTP" | "Axelar ITS")}
            className={`
              p-3 rounded-md border transition-all duration-200
              ${bridgeProtocol === protocol
                ? 'bg-gray-800 text-green-500 border-green-500/30'
                : 'border-amber-700/40 bg-amber-900/10 hover:bg-amber-900/20'
              }
            `}
          >
            <div className="flex flex-col items-center space-y-2">
              <span className="text-sm font-medium">
                {protocol === 'CCIP' ? 'Chainlink CCIP' : 'Circle CCTP'}
              </span>
              <h4 className="text-sm font-medium opacity-80">
                {networkConfig.name === 'Ripple Testnet' ? 'XRP' : 'USDC'}
              </h4>
              <span className="text-xs opacity-70">
                {protocol === 'CCIP'
                  ? 'Cross-Chain Interoperability Protocol'
                  : 'Cross-Chain Transfer Protocol'
                }
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderTransactionBox = () => {
    if (!currentStake || !showTransactionBox) return null;

    const getProgressValue = () => {
      if (currentStake.status === 'SUCCESS') return 100;
      if (currentStake.status === 'FAILURE') return 100;
      if (currentStake.isBlessed) return 75;
      if (currentStake.isCommitted) return 50;
      if (currentStake.status === 'IN_PROGRESS') return 25;
      return 0;
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mt-4 p-4 border border-amber-700/40 rounded-md bg-amber-900/10"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Transaction Status</h3>
          <button
            onClick={() => setShowTransactionBox(false)}
            className="p-1 hover:bg-amber-700/30 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Status: {currentStake.status}</span>
            <span>Expected Time: {currentStake.expectedTime}</span>
          </div>

          {currentStake.sourceTxHash && (
            <div className="text-sm break-all">
              <span className="text-amber-500">Source Tx:</span>
              <a
                href={getExplorerUrl(currentStake.sourceTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-amber-400 hover:text-green-500"
              >
                {currentStake.sourceTxHash}
              </a>
              <p className="text-xs opacity-70 mt-1">Stake {stakeAmount || '0'} {networkConfig.name === 'Ripple Testnet' ? 'XRP' : 'USDC'}</p>
            </div>
          )}

          {/* Show CCIP Message ID only for CCIP transactions */}
          {bridgeProtocol === 'CCIP' && currentStake.ccipMessageId && (
            <div className="text-sm break-all">
              <span className="text-amber-500">CCIP Message ID:</span>
              <a
                href={`https://ccip.chain.link/msg/${currentStake.ccipMessageId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-amber-400 hover:text-green-500"
              >
                {currentStake.ccipMessageId}
              </a>
            </div>
          )}

          {currentStake.destinationTxHash && (
            <div className="text-sm break-all">
              <span className="text-amber-500">Destination Tx:</span>
              <a
                href={`https://sepolia.etherscan.io/tx/${currentStake.destinationTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-amber-400 hover:text-green-500"
              >
                {currentStake.destinationTxHash}
              </a>
            </div>
          )}

          {/* Show countdown for CCTP transactions */}
          {bridgeProtocol === 'CCTP' && currentStake.status === 'SUCCESS' && !showSuccessDelay && (
            <div className="mt-4 text-sm text-center">
              {/* <p>Showing transaction details for 30 seconds...</p>
              <p className="text-xs opacity-70">You will be redirected to the dashboard view shortly</p> */}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderStakeForm = () => (
    <div className="space-y-4 p-2">
      {!currentStake && renderProtocolSelector()}

      <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm opacity-70">Available {networkConfig.name === 'Ripple Testnet' ? 'XRP' : 'USDC'}</span>
          <div>Available: {parseFloat(usdcBalance.toString()).toFixed(4)} {networkConfig.name === 'Ripple Testnet' ? 'XRP' : 'USDC'}</div>
        </div>
        <div className="border-t border-amber-700/30 pt-3 mt-2">
          <AmountInput
            value={stakeAmount}
            onChange={setStakeAmount}
            min={0}
            step={0.01}
            label={`Stake Amount (${bridgeProtocol})`}
            suffix={networkConfig.name === 'Ripple Testnet' ? 'XRP' : 'USDC'}
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      <Button
        onClick={handleStakeSubmit}
        disabled={
          stakeAmount <= 0 ||
          stakeAmount > usdcBalance ||
          (bridgeProtocol === "CCIP" && linkBalance < 10) ||
          isStaking ||
          isApproving ||
          currentStake?.status === 'IN_PROGRESS'
        }
        fullWidth
      >
        {isApproving ? 'Approving...'
          : isStaking || currentStake?.status === 'IN_PROGRESS' ? 'Staking in Progress...'
            : stakeAmount > usdcBalance ? `Insufficient ${networkConfig.name === 'Ripple Testnet' ? 'XRP' : 'USDC'}`
              : bridgeProtocol === "CCIP" && linkBalance < 10 ? 'Insufficient LINK Balance'
                : !hasAllowance ? `Approve and Stake in ${bridgeProtocol}`
                  : `Stake with ${bridgeProtocol}`}
      </Button>

      <AnimatePresence>
        {renderTransactionBox()}
      </AnimatePresence>
    </div>
  );

  const renderConfirming = () => (
    <div className="p-4 flex flex-col items-center justify-center">
      <div className="mb-6">
        <Loader2 size={48} className="animate-spin text-amber-500" />
      </div>
      <h3 className="text-xl mb-2">Confirming Transaction</h3>
      <p className="text-sm opacity-70 text-center">
        Please confirm the transaction in your wallet
      </p>
    </div>
  );

  const renderSuccess = () => (
    <div className="p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl">Stake Complete</h3>
          <Button
            onClick={resetForm}
            className="hover:bg-amber-900/20"
          >
            Stake More
          </Button>
        </div>
        <p className="text-sm opacity-70 mt-2">
          Successfully staked {stakeAmount.toFixed(4)} {networkConfig.name === 'Ripple Testnet' ? 'XRP' : 'USDC'}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {currentStake?.sourceTxHash && (
          <div className="p-3 rounded border border-amber-700/30 bg-amber-900/10">
            <div className="text-xs opacity-70 mb-1">Transaction Hash</div>
            <a
              href={getExplorerUrl(currentStake.sourceTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 hover:text-amber-400"
            >
              <span className="break-all">{currentStake.sourceTxHash}</span>
              <ArrowUpRight size={14} />
            </a>
          </div>
        )}
      </div>
    </div>
  );

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center mb-6">
          <h1 className="text-2xl mb-2">Connect Your Wallet</h1>
          <p className="opacity-70">Please connect your wallet to start staking</p>
        </div>
        {/* <ConnectKitButton.Custom>
          {({ show }) => (
            <Button onClick={show} size="lg">
              Connect Wallet
            </Button>
          )}
        </ConnectKitButton.Custom> */}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Stake Asset</h1>
        <p className="text-sm opacity-70">
          {networkConfig.name === 'Ripple Testnet'
            ? 'Stake your XRP using Axelar ITS and receive LST + APR in return'
            : 'Stake your USDC using CCIP/CCTP and receive LST + APR in return'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-700 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <XCircle size={20} className="text-red-400 mr-2" />
              <span className="text-red-400">{error}</span>
            </div>
            <Button onClick={handleClearError} variant="danger" size="sm">
              Try Again
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Window title={`Stake Asset`}>
          {stakeView === 'success'
            ? renderSuccess()
            : renderStakeForm()
          }
        </Window>

        <div className="flex flex-col gap-6">
          {networkConfig.name === 'Ripple Testnet' && stakingOffers && stakingOffers.length > 0 && (
            <Window title="Action Required: Pending Receipts">
              <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[300px] p-2 pr-3">
                {stakingOffers.map((item: { id: string, offerIndex: string, receipt: any }) => (
                  <div key={item.id} className="border border-indigo-500/50 rounded-md p-4 bg-indigo-900/20 flex flex-col relative overflow-hidden backdrop-blur-sm">
                    <div className="absolute top-0 right-0 bg-indigo-500/20 text-indigo-300 text-[9px] px-2 py-1 rounded-bl-md font-mono border-l border-b border-indigo-500/20">
                      {item.id.substring(0, 8)}...
                    </div>
                    <h3 className="text-sm font-medium text-indigo-400 mb-1 truncate pr-16">{item.receipt.pool}</h3>
                    <div className="flex items-end mb-3">
                      <span className="text-2xl font-semibold tracking-tight">{item.receipt.amount}</span>
                      <span className="ml-1.5 text-sm opacity-80 mb-1 font-medium bg-indigo-900/50 px-1.5 py-0.5 rounded text-indigo-200">{item.receipt.token}</span>
                    </div>

                    <div className="mt-2 pt-3 border-t border-indigo-500/40">
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            // @ts-ignore
                            const crossmarkSdk = window.xrpl?.crossmark || window.crossmark;
                            if (!crossmarkSdk) throw new Error("Crossmark extension not found");
                            const tx = {
                              TransactionType: "NFTokenAcceptOffer",
                              Account: address,
                              NFTokenSellOffer: item.offerIndex
                            };
                            let result;
                            if (crossmarkSdk.methods && typeof crossmarkSdk.methods.signAndSubmitAndWait === 'function') {
                              result = await crossmarkSdk.methods.signAndSubmitAndWait(tx);
                            } else if (typeof crossmarkSdk.signAndSubmitAndWait === 'function') {
                              result = await crossmarkSdk.signAndSubmitAndWait(tx);
                            } else if (crossmarkSdk.methods && typeof crossmarkSdk.methods.signAndSubmit === 'function') {
                              result = await crossmarkSdk.methods.signAndSubmit(tx);
                            } else if (typeof crossmarkSdk.signAndSubmit === 'function') {
                              result = await crossmarkSdk.signAndSubmit(tx);
                            } else {
                              throw new Error("signAndSubmit not found on crossmark SDK");
                            }
                            console.log("Offer accepted successfully via Crossmark:", result);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      >
                        Accept Receipt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Window>
          )}

          {networkConfig.name === 'Ripple Testnet' ? (
            <Window title="Your Minted Staking Receipts (XRPL NFTs)">
              {stakingNFTs.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[500px] p-2 pr-3">
                  {stakingNFTs.map((item: { id: string, receipt: any }) => (
                    <div
                      key={item.id}
                      className="border border-amber-700/50 rounded-md p-4 bg-amber-900/20 flex flex-col relative overflow-hidden backdrop-blur-sm cursor-pointer hover:border-amber-500/70 transition-colors"
                      onClick={() => setExpandedNFT(expandedNFT === item.id ? null : item.id)}
                    >
                      <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-300 text-[9px] px-2 py-1 rounded-bl-md font-mono border-l border-b border-amber-500/20">
                        {item.id.substring(0, 8)}...
                      </div>
                      <h3 className="text-sm font-medium text-amber-400 mb-1 truncate pr-16">{item.receipt.pool}</h3>
                      <div className="flex items-end mb-3">
                        <span className="text-2xl font-semibold tracking-tight">{item.receipt.amount}</span>
                        <span className="ml-1.5 text-sm opacity-80 mb-1 font-medium bg-amber-900/50 px-1.5 py-0.5 rounded text-amber-200">{item.receipt.token}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs opacity-70 mt-auto pt-3 border-t border-amber-700/40">
                        <div className="flex flex-col">
                          <span className="opacity-60 mb-0.5">Minted Asset</span>
                          <span className="text-amber-100 font-medium">{item.receipt.mintedStETH || '0'} stETH</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="opacity-60 mb-0.5">APR</span>
                          <span className="text-green-400 font-medium tracking-wide">{item.receipt.apy}%</span>
                        </div>
                      </div>

                      {expandedNFT === item.id && (
                        <div className="mt-3 pt-3 border-t border-gray-600/60 space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
                          <h4 className="text-white font-semibold text-sm mb-2">Full Metadata</h4>
                          <div className="grid grid-cols-1 gap-2 bg-gray-900 border border-gray-700/60 rounded-lg p-3.5 font-mono text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-gray-400">NFToken ID</span>
                              <span className="text-white break-all text-right ml-4">{item.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Staker</span>
                              <span className="text-white break-all text-right ml-4">{item.receipt.staker}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Amount</span>
                              <span className="text-white">{item.receipt.amount} {item.receipt.token}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Pool</span>
                              <span className="text-white">{item.receipt.pool}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Minted stETH</span>
                              <span className="text-white">{item.receipt.mintedStETH || '0'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">APY</span>
                              <span className="text-green-400 font-semibold">{item.receipt.apy}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Lock Period</span>
                              <span className="text-white">{item.receipt.days > 0 ? `${item.receipt.days} days` : 'Flexible'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Staked At</span>
                              <span className="text-white">{item.receipt.stakedAt ? new Date(item.receipt.stakedAt * 1000).toLocaleString() : '--'}</span>
                            </div>
                            {item.receipt.txHash && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Tx Hash</span>
                                <a
                                  href={`https://sepolia.etherscan.io/tx/${item.receipt.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline break-all text-right ml-4"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {item.receipt.txHash.substring(0, 16)}...
                                </a>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-400">Receipt ID</span>
                              <span className="text-white">{item.receipt.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Version</span>
                              <span className="text-white">v{item.receipt.v}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center h-full border border-amber-700/30 rounded-md bg-amber-900/10 min-h-[160px] m-2">
                  <h3 className="text-amber-400 font-medium mb-1">No Minted Receipts</h3>
                  <p className="text-sm opacity-60">Stake USDC using Axelar ITS to mint a receipt NFT on the XRPL.</p>
                </div>
              )}
            </Window>
          ) : (
            <Window title="Staking Information">
              <div className="space-y-4 p-2">
                <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
                  <h3 className="text-sm font-medium mb-2">About rnstETH</h3>
                  <p className="text-sm opacity-80 leading-relaxed">
                    rnstETH is a token that represents your staked USDC in the LIDO protocol.
                    You can transfer or trade rnstETH like any other token while continuing to earn staking rewards.
                  </p>
                </div>

                <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
                  <h3 className="text-sm font-medium mb-2">Current Statistics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="opacity-70">Total USDC Staked</span>
                      <span>-- USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Current APR</span>
                      <span className="text-green-400">{lidoAPY ? `${lidoAPY.toFixed(2)}%` : '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Total Stakers</span>
                      <span>--</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRightLeft size={24} className="mr-2" />
                  <span className="text-sm opacity-80">{networkConfig.name === 'Ripple Testnet' ? '1 rnstETH = 1 stETH' : '1 rnstETH = 1 stETH'}</span>
                </div>
              </div>
            </Window>
          )}
        </div>
      </div>
    </div>
  );
};

export default Stake;