import { useState, useEffect } from 'react';
import { useWallet } from '../lib/walletConnect';
import { useStaking } from '../hooks/useStaking';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import Button from '../components/Button';
import Window from '../components/Window';
import AmountInput from '../components/AmountInput';
import { Progress } from '../components/Progress';
import { ArrowRightLeft, Loader2, ChevronRight, CheckCircle2, XCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUPPORTED_NETWORKS } from '../config/contract';
import { getLidoAPY } from '../services/api';

const Stake = () => {
  const { isConnected, balance, connect, networkConfig } = useWallet();
  const { stake, stakeStatus, isStaking, bridgeProtocol, setBridgeProtocol, checkAllowance, isApproving, usdcBalance , linkBalance } = useStaking();
  const [stakeAmount, setStakeAmount] = useState(0);
  const [hasAllowance, setHasAllowance] = useState(false);
  const [stakeView, setStakeView] = useState<'form' | 'confirming' | 'success'>('form');
  const [error, setError] = useState<string | null>(null);
  const [currentStake, setCurrentStake] = useState<StakeStatus | null>(null);
  const [showTransactionBox, setShowTransactionBox] = useState(false);
  const [showSuccessDelay, setShowSuccessDelay] = useState(false);
  const [lidoAPY, setLidoAPY] = useState<number | null>(null);

  const getExplorerUrl = (txHash: string) => {
    const network = Object.values(SUPPORTED_NETWORKS).find(net => net.chainId === networkConfig.chainId);
    if (!network) return `https://sepolia.arbiscan.io/tx/${txHash}`;
    
    switch (network.name.toLowerCase()) {
      case 'arbitrum sepolia':
        return `https://sepolia.arbiscan.io/tx/${txHash}`;
      case 'base sepolia':
        return `https://sepolia.basescan.org/tx/${txHash}`;
      case 'polygon amoy':
        return `https://www.oklink.com/amoy/tx/${txHash}`;
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
      await stake(stakeAmount);
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
    // For Base Sepolia, only show CCIP
    if (networkConfig.name === 'Base Sepolia') {
      return (
        <div className="mb-4">
          <button
            className="p-3 rounded-md border border-amber-500 bg-amber-900/30 shadow-lg shadow-amber-900/20 w-full"
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
            onClick={() => setBridgeProtocol(protocol as "CCIP" | "CCTP")}
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
          <span className="text-sm opacity-70">Available USDC</span>
          <span>{usdcBalance.toFixed(2)} USDC</span>
        </div>
        <div className="border-t border-amber-700/30 pt-3 mt-2">
          <AmountInput
            value={stakeAmount}
            onChange={setStakeAmount}
            min={0}
            max={usdcBalance}
            step={0.01}
            label={`Stake Amount (${bridgeProtocol})`}
            suffix="USDC"
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>
      
      <Button 
        onClick={handleStakeSubmit}
        disabled={
          stakeAmount <= 0 || 
          stakeAmount > usdcBalance || 
          bridgeProtocol === "CCIP" && linkBalance < 10 || 
          isStaking || 
          isApproving ||
          currentStake?.status === 'IN_PROGRESS'
        }
        fullWidth
      >
        {isApproving ? 'Approving...' :
         isStaking || currentStake?.status === 'IN_PROGRESS' ? 'Staking in Progress...' : 
         !hasAllowance ? `Approve for ${bridgeProtocol}` :
          bridgeProtocol === "CCIP" && linkBalance < 10 ? 'Insufficient Link Balance' :
         `Stake with ${bridgeProtocol}`}
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
          Successfully staked {stakeAmount.toFixed(4)} USDC
        </p>
      </div>

      <div className="mt-6">
        <Button 
          onClick={() => window.location.href = '/dashboard'} 
          variant="primary"
          fullWidth
        >
          View Dashboard
        </Button>
      </div>
    </div>
  );
  
  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center mb-6">
          <h1 className="text-2xl mb-2">Connect Your Wallet</h1>
          <p className="opacity-70">Please connect your wallet to stake</p>
        </div>
        <Button onClick={connect} size="lg">Connect Wallet</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Stake Asset</h1>
        <p className="text-sm opacity-70">
          Stake your USDC using CCIP/CCTP and receive LST + APR in return
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
              <span className="text-sm opacity-80">1 rnstETH = 1 stETH</span>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
};

export default Stake;