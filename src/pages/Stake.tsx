import { useState, useEffect } from 'react';
import { useWallet } from '../lib/walletConnect';
import { useStaking } from '../hooks/useStaking';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import Button from '../components/Button';
import Window from '../components/Window';
import AmountInput from '../components/AmountInput';
import { ArrowRightLeft, XCircle, X, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BridgeProtocol } from '../config/contract';
import { getLidoAPY } from '../services/api';
import ReactGA from 'react-ga4';
import { getTxExplorerUrl } from '../lib/networkSupport';

type UiReceipt = {
  [key: string]: string | number | undefined;
  pool?: string;
  amount?: string | number;
  token?: string;
  staker?: string;
  mintedStETH?: string | number;
  apy?: string | number;
  days?: number;
  stakedAt?: number;
  txHash?: string;
  id?: string;
  v?: string | number;
};

const PROTOCOL_META: Record<BridgeProtocol, { title: string; subtitle: string }> = {
  CCIP: {
    title: 'Chainlink CCIP',
    subtitle: 'Cross-Chain Interoperability Protocol'
  },
  CCTP: {
    title: 'Circle CCTP',
    subtitle: 'Cross-Chain Transfer Protocol'
  },
  'Axelar ITS': {
    title: 'Axelar ITS',
    subtitle: 'Interchain Token Service'
  }
};

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  FAILURE: 'bg-red-500/20 text-red-300 border-red-400/40',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  COMMITTED: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
  BLESSED: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
  BRIDGING_BACK: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
  UNTOUCHED: 'bg-zinc-500/20 text-zinc-300 border-zinc-400/40'
};

const Stake = () => {
  const { isConnected, networkConfig, address } = useWallet();
  const {
    stake,
    bridgeProtocol,
    setBridgeProtocol,
    checkAllowance,
    isStaking,
    isApproving,
    usdcBalance,
    linkBalance,
    stakingNFTs,
    stakingOffers,
    supportedProtocols,
    assetSymbol
  } = useStaking();
  const [stakeAmount, setStakeAmount] = useState(0);
  const [hasAllowance, setHasAllowance] = useState(false);
  const [stakeView, setStakeView] = useState<'form' | 'confirming' | 'success'>('form');
  const [error, setError] = useState<string | null>(null);
  const [currentStake, setCurrentStake] = useState<StakeStatus | null>(null);
  const [showTransactionBox, setShowTransactionBox] = useState(false);
  const [showSuccessDelay, setShowSuccessDelay] = useState(false);
  const [lidoAPY, setLidoAPY] = useState<number | null>(null);
  const [expandedNFT, setExpandedNFT] = useState<string | null>(null);
  const isRippleNetwork = supportedProtocols.includes('Axelar ITS');
  const getExplorerUrl = (txHash: string, protocol: BridgeProtocol | string = bridgeProtocol) =>
    getTxExplorerUrl(txHash, networkConfig.name, protocol);

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
    const activeStatus = stakeManager.getCurrentStatus();
    if (activeStatus) {
      setCurrentStake(activeStatus);
      setShowTransactionBox(true);
      if (activeStatus.status === 'SUCCESS') {
        setStakeView('success');
      }
    }

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

  const extractWalletError = (error: any): string => {
    if (!error) return 'Transaction failed.';

    const patterns: [RegExp, string][] = [
      [/user\s*rejected/i, 'User rejected the transaction in wallet.'],
      [/ACTION_REJECTED/i, 'User rejected the transaction in wallet.'],
      [/User\s*denied/i, 'User denied the transaction in wallet.'],
      [/MetaMask Tx Signature.*User\s*denied/i, 'User denied the MetaMask transaction signature.'],
      [/insufficient\s*funds/i, 'Insufficient funds for gas or value.'],
      [/gas\s*required\s*exceeds\s*allowance/i, 'Gas required exceeds allowance — insufficient native token.'],
      [/execution\s*reverted/i, 'Transaction reverted by the contract.'],
      [/nonce.*too\s*low/i, 'Nonce too low. Submit again with a higher nonce.'],
      [/replacement.*underpriced/i, 'Replacement fee too low. Increase gas.'],
      [/chain\s*mismatch/i, 'Network mismatch. Switch to the correct chain in your wallet.'],
    ];

    const rawMsg =
      error?.shortMessage ||
      error?.details ||
      error?.info?.error?.message ||
      (typeof error?.message === 'string' ? error.message : '') ||
      '';

    for (const [re, replacement] of patterns) {
      if (re.test(rawMsg)) return replacement;
    }

    if (rawMsg) return rawMsg;
    return 'Transaction failed. Please try again.';
  };

  const handleStakeSubmit = async () => {
    if (stakeAmount <= 0) return;
    setError(null);

    try {
      ReactGA.event({
        category: 'Social Links',
        action: 'Click',
        label: `Staking ${assetSymbol} ${address} on ${networkConfig.name} using ${bridgeProtocol}`,
      });
      await stake(stakeAmount, lidoAPY ? lidoAPY.toFixed(2) : undefined);
    } catch (error: any) {
      console.error('Staking failed:', error);
      setError(extractWalletError(error));
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
    if (supportedProtocols.length === 1) {
      const protocol = supportedProtocols[0];
      return (
        <div className="mb-2 premium-card rounded-xl border border-black/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow mb-1">Protocol Route</div>
              <div className="text-base font-semibold">{PROTOCOL_META[protocol].title}</div>
              <div className="muted-copy text-xs">{PROTOCOL_META[protocol].subtitle}</div>
            </div>
            <span className="premium-pill rounded-full px-3 py-1 text-xs">Active</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`grid gap-3 mb-2 ${supportedProtocols.length > 2 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {supportedProtocols.map((protocol) => (
          <button
            key={protocol}
            onClick={() => setBridgeProtocol(protocol as BridgeProtocol)}
            className={`
              p-4 rounded-xl border transition-all duration-200 text-left
              ${bridgeProtocol === protocol
                ? 'premium-pill border-[rgba(var(--accent),0.24)] shadow-lg shadow-[rgba(16,122,110,0.12)]'
                : 'premium-card hover:border-[rgba(var(--accent),0.24)]'
              }
            `}
          >
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-semibold">{PROTOCOL_META[protocol as BridgeProtocol].title}</span>
              <span className="muted-copy text-xs">{PROTOCOL_META[protocol as BridgeProtocol].subtitle}</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderTransactionBox = () => {
    if (!currentStake || !showTransactionBox) return null;
    const transactionProtocol = currentStake.protocol || bridgeProtocol;
    const statusStyle = STATUS_STYLES[currentStake.status] || STATUS_STYLES.UNTOUCHED;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mt-4 p-4 rounded-xl premium-card"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Transaction Status</h3>
          <button
            onClick={() => setShowTransactionBox(false)}
            className="rounded-full p-1 hover:bg-black/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusStyle}`}>
              {currentStake.status.replace('_', ' ')}
            </span>
            <span>Expected Time: {currentStake.expectedTime}</span>
          </div>

          {currentStake.sourceTxHash && (
            <div className="text-sm break-all premium-card rounded-lg p-3">
              <span className="eyebrow">Source Tx</span>
              <a
                href={getExplorerUrl(currentStake.sourceTxHash, transactionProtocol)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center text-[rgb(var(--accent-strong))] hover:opacity-80"
              >
                {currentStake.sourceTxHash}
              </a>
              <p className="muted-copy mt-1 text-xs">Stake {stakeAmount || '0'} {assetSymbol}</p>
            </div>
          )}

          {/* Show CCIP Message ID only for CCIP transactions */}
          {transactionProtocol === 'CCIP' && currentStake.ccipMessageId && (
            <div className="text-sm break-all premium-card rounded-lg p-3">
              <span className="eyebrow">CCIP Message ID</span>
              <a
                href={`https://ccip.chain.link/msg/${currentStake.ccipMessageId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center text-[rgb(var(--accent-strong))] hover:opacity-80"
              >
                {currentStake.ccipMessageId}
              </a>
            </div>
          )}

          {currentStake.destinationTxHash && (
            <div className="text-sm break-all premium-card rounded-lg p-3">
              <span className="eyebrow">Destination Tx</span>
              <a
                href={`https://sepolia.etherscan.io/tx/${currentStake.destinationTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center text-[rgb(var(--accent-strong))] hover:opacity-80"
              >
                {currentStake.destinationTxHash}
              </a>
            </div>
          )}

          {/* Show countdown for CCTP transactions */}
          {transactionProtocol === 'CCTP' && currentStake.status === 'SUCCESS' && !showSuccessDelay && (
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

      <div className="premium-card rounded-xl p-4">
        <div className="eyebrow mb-3">Supported On This Network</div>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div>
            <span className="muted-copy">Network</span>
            <div className="mt-1 font-medium">{networkConfig.name}</div>
          </div>
          <div>
            <span className="muted-copy">Protocols</span>
            <div className="mt-1 font-medium">{supportedProtocols.join(', ')}</div>
          </div>
          <div>
            <span className="muted-copy">Asset</span>
            <div className="mt-1 font-medium">{assetSymbol}</div>
          </div>
        </div>
      </div>

      <div className="premium-card rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="eyebrow">Available Balance</span>
          <div className="text-sm font-medium">
            {parseFloat(usdcBalance.toString()).toFixed(4)} {assetSymbol}
          </div>
        </div>
        <div className="border-t premium-divider pt-3">
          <AmountInput
            value={stakeAmount}
            onChange={setStakeAmount}
            min={0}
            step={0.01}
            label={`Stake Amount (${bridgeProtocol})`}
            suffix={assetSymbol}
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
        className="h-11 rounded-xl"
      >
        {isApproving ? 'Approving...'
          : isStaking || currentStake?.status === 'IN_PROGRESS' ? 'Staking in Progress...'
            : stakeAmount > usdcBalance ? `Insufficient ${assetSymbol}`
              : bridgeProtocol === "CCIP" && linkBalance < 10 ? 'Insufficient LINK Balance'
                : !hasAllowance ? `Approve and Stake in ${bridgeProtocol}`
                  : `Stake with ${bridgeProtocol}`}
      </Button>

      <AnimatePresence>
        {renderTransactionBox()}
      </AnimatePresence>
    </div>
  );

  const renderSuccess = () => (
    <div className="p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl">Stake Complete</h3>
          <Button
            onClick={resetForm}
            className="hover:bg-black/5"
          >
            Stake More
          </Button>
        </div>
        <p className="muted-copy mt-2 text-sm">
          Successfully staked {stakeAmount.toFixed(4)} {assetSymbol}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {currentStake?.sourceTxHash && (
          <div className="premium-card rounded-xl p-4">
            <div className="eyebrow mb-2">Transaction Hash</div>
            <a
              href={getExplorerUrl(currentStake.sourceTxHash, bridgeProtocol)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-[rgb(var(--accent-strong))] hover:opacity-80"
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
    <div className="route-scroll">
      <div className="page-canvas page-wide flex min-h-full flex-col gap-4">
      <div className="premium-surface rounded-[32px] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <div className="eyebrow">Cross-chain staking desk</div>
            <h1 className="mt-4 text-4xl font-semibold">Stake Asset</h1>
            <p className="muted-copy mt-3 max-w-2xl text-base leading-7">
              {isRippleNetwork
                ? 'Stake XRP using Axelar ITS and receive LST + APR in return'
                : 'Stake your USDC using CCIP/CCTP and receive LST + APR in return'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold xl:justify-end">
            <span className="premium-pill rounded-full px-3 py-1.5">{networkConfig.name}</span>
            <span className="premium-card rounded-full px-3 py-1.5">{supportedProtocols.join(' / ')}</span>
            <span className="premium-card rounded-full px-3 py-1.5">Asset: {assetSymbol}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="premium-card rounded-[24px] border border-red-500/25 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <XCircle size={20} className="text-red-400 mr-2" />
              <span className="text-red-300">{error}</span>
            </div>
            <Button onClick={handleClearError} variant="danger" size="sm">
              Try Again
            </Button>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-5">
        <Window title="Stake Asset" className="xl:col-span-3">
          {stakeView === 'success'
            ? renderSuccess()
            : renderStakeForm()
          }
        </Window>

        <div className="flex min-h-0 flex-col gap-4 xl:col-span-2 xl:overflow-auto">
          {isRippleNetwork && stakingOffers && stakingOffers.length > 0 && (
            <Window title="Action Required: Pending Receipts">
              <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[300px] p-2 pr-3">
                {stakingOffers.map((item: { id: string, offerIndex: string, receipt: UiReceipt }) => (
                  <div key={item.id} className="premium-card rounded-[24px] p-4 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-indigo-500/15 text-indigo-600 text-[9px] px-2 py-1 rounded-bl-md font-mono border-l border-b border-indigo-500/20">
                      {item.id.substring(0, 8)}...
                    </div>
                    <h3 className="text-sm font-medium text-indigo-600 mb-1 truncate pr-16">{item.receipt.pool}</h3>
                    <div className="flex items-end mb-3">
                      <span className="text-2xl font-semibold tracking-tight">{item.receipt.amount}</span>
                      <span className="ml-1.5 text-sm opacity-80 mb-1 font-medium bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-700">{item.receipt.token}</span>
                    </div>

                    <div className="mt-2 pt-3 border-t border-indigo-500/20">
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            // @ts-expect-error crossmark SDK is injected at runtime.
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

          {isRippleNetwork ? (
            <Window title="Your Minted Staking Receipts (XRPL NFTs)">
              {stakingNFTs.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[500px] p-2 pr-3">
                  {stakingNFTs.map((item: { id: string, receipt: UiReceipt }) => (
                    <div
                      key={item.id}
                      className="premium-card rounded-[24px] p-4 flex flex-col relative overflow-hidden cursor-pointer hover:border-[rgba(var(--accent),0.28)] transition-colors"
                      onClick={() => setExpandedNFT(expandedNFT === item.id ? null : item.id)}
                    >
                      <div className="absolute top-0 right-0 bg-[rgba(var(--accent),0.12)] text-[rgb(var(--accent-strong))] text-[9px] px-2 py-1 rounded-bl-md font-mono border-l border-b border-[rgba(var(--accent),0.12)]">
                        Info
                      </div>
                      <h3 className="text-sm font-medium mb-1 truncate pr-16">{item.receipt.pool}</h3>
                      <div className="flex items-end mb-3">
                        <span className="text-2xl font-semibold tracking-tight">{item.receipt.amount}</span>
                        <span className="ml-1.5 text-sm opacity-80 mb-1 font-medium bg-black/5 px-1.5 py-0.5 rounded">{item.receipt.token}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs opacity-80 mt-auto pt-3 border-t border-black/5">
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
                        <div className="mt-3 pt-3 border-t border-black/5 space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
                          <h4 className="font-semibold text-sm mb-2">Full Metadata</h4>
                          <div className="grid grid-cols-1 gap-2 premium-card border rounded-lg p-3.5 font-mono text-[11px]">
                            <div className="flex justify-between">
                              <span className="muted-copy">NFToken ID</span>
                              <span className="break-all text-right ml-4">{item.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="muted-copy">Staker</span>
                              <span className="break-all text-right ml-4">{item.receipt.staker}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="muted-copy">Amount</span>
                              <span>{item.receipt.amount} {item.receipt.token}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="muted-copy">Pool</span>
                              <span>{item.receipt.pool}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="muted-copy">Minted stETH</span>
                              <span>{item.receipt.mintedStETH || '0'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="muted-copy">APY</span>
                              <span className="text-green-400 font-semibold">{item.receipt.apy}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="muted-copy">Lock Period</span>
                              <span>{item.receipt.days > 0 ? `${item.receipt.days} days` : 'Flexible'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="muted-copy">Staked At</span>
                              <span>{item.receipt.stakedAt ? new Date(item.receipt.stakedAt * 1000).toLocaleString() : '--'}</span>
                            </div>
                            {item.receipt.txHash && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Tx Hash</span>
                                <a
                                  href={`https://testnet.axelarscan.io/gmp//${item.receipt.txHash}`}
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
                              <span className="muted-copy">Receipt ID</span>
                              <span>{item.receipt.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="muted-copy">Version</span>
                              <span>v{item.receipt.v}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center h-full premium-card rounded-[24px] min-h-[160px] m-2">
                  <h3 className="font-medium mb-1">No Minted Receipts</h3>
                  <p className="muted-copy text-sm">Stake XRP using Axelar ITS to mint a receipt NFT on the XRPL.</p>
                </div>
              )}
            </Window>
          ) : (
            <Window title="Staking Intelligence">
              <div className="space-y-4 p-2">
                <div className="premium-card rounded-[24px] p-4">
                  <h3 className="text-sm font-medium mb-2">About rnstETH</h3>
                  <p className="muted-copy text-sm leading-relaxed">
                    rnstETH represents your staked USDC in the Lido strategy flow.
                    It stays transferable while the underlying stake keeps accruing yield.
                  </p>
                </div>

                <div className="premium-card rounded-[24px] p-4">
                  <h3 className="text-sm font-medium mb-3">Current Statistics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="muted-copy">Total USDC Staked</span>
                      <span>-- USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="muted-copy">Current APR</span>
                      <span className="text-green-400">{lidoAPY ? `${lidoAPY.toFixed(2)}%` : '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="muted-copy">Total Stakers</span>
                      <span>--</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center premium-card rounded-[24px] p-4">
                  <ArrowRightLeft size={20} className="mr-2 text-[rgb(var(--accent-strong))]" />
                  <span className="text-sm">1 rnstETH = 1 stETH</span>
                </div>
              </div>
            </Window>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default Stake;
