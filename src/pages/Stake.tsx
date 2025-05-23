import { useState, useEffect } from 'react';
import { useWallet } from '../lib/walletConnect';
import { useStaking } from '../hooks/useStaking';
import { useStakingStore } from '../store/stakingStore';
import Button from '../components/Button';
import Window from '../components/Window';
import AmountInput from '../components/AmountInput';
import { Progress } from '../components/Progress';
import { ArrowRightLeft, Loader2, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const Stake = () => {
  const { isConnected, balance, connect } = useWallet();
  const { stake, stakeStatus, isStaking, bridgeProtocol, setBridgeProtocol, hasAllowance, isApproving, usdcBalance } = useStaking();
  const { currentStake, setCurrentStake, updateStakeStatus, clearStake } = useStakingStore();
  const [stakeAmount, setStakeAmount] = useState(0);
  const [stakeView, setStakeView] = useState<'form' | 'confirming' | 'success'>('form');
  const [error, setError] = useState<string | null>(null);

  const handleStakeSubmit = async () => {
    if (stakeAmount <= 0) return;
    setError(null);

    setCurrentStake({
      amount: stakeAmount,
      status: null,
      isInProgress: true,
      protocol: bridgeProtocol,
      startTimestamp: Date.now()
    });

    try {
      await stake(stakeAmount);
    } catch (error) {
      console.error('Staking failed:', error);
      setError('Transaction failed. Please try again.');
      clearStake();
    }
  };

  const handleClearError = () => {
    setError(null);
    clearStake();
  };

  useEffect(() => {
    if (stakeStatus) {
      updateStakeStatus(stakeStatus);

      if (stakeStatus.status === 'SUCCESS') {
        setStakeView('success');
      }
    }
  }, [stakeStatus]);

  useEffect(() => {
    if (currentStake?.isInProgress) {
      setStakeView(currentStake.status?.status === 'SUCCESS' ? 'success' : 'form');
    }
  }, []);

  useEffect(() => {
    if (currentStake?.isInProgress && currentStake.status?.timestamp) {
      const timeElapsed = formatTimeElapsed(currentStake.status.timestamp);
      updateStakeStatus({
        ...currentStake.status,
        timeElapsed,
      });
    }
  }, []);

  useEffect(() => {
    if (currentStake?.isInProgress && currentStake.status?.timestamp) {
      const interval = setInterval(() => {
        const timeElapsed = formatTimeElapsed(currentStake.status!.timestamp);
        updateStakeStatus({
          ...currentStake.status!,
          timeElapsed,
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentStake?.isInProgress, currentStake?.status?.timestamp]);

  const formatTimeElapsed = (startTime: number): string => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const resetForm = () => {
    setStakeAmount(0);
    setStakeView('form');
    clearStake();
    setError(null);
  };

  const renderProtocolSelector = () => (
    <div className="grid grid-cols-2 gap-4 mb-4">
      {['CCIP', 'CCTP'].map((protocol) => (
        <button
          key={protocol}
          onClick={() => setBridgeProtocol(protocol as "CCIP" | "CCTP")}
          className={`
            p-3 rounded-md border transition-all duration-200
            ${bridgeProtocol === protocol 
              ? 'border-amber-500 bg-amber-900/30 shadow-lg shadow-amber-900/20' 
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

  const renderStakeStatus = () => {
    if (!currentStake?.status) return null;

    const getProgressValue = () => {
      if (!currentStake?.status) return 0;
      if (currentStake.status.status === 'SUCCESS') return 100;
      if (currentStake.status.status === 'FAILURE') return 100;
      if (currentStake.status.isBlessed) return 75;
      if (currentStake.status.isCommitted) return 50;
      if (currentStake.status.status === 'IN_PROGRESS') return 25;
      return 0;
    };

    return (
      <div className="mt-4 p-4 border border-amber-700/40 rounded-md bg-amber-900/10">
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Status: {currentStake.status.status}</span>
            <span>Time Elapsed: {currentStake.status.timeElapsed}</span>
          </div>

          <Progress value={getProgressValue()} />

          {currentStake.status.sourceTxHash && (
            <div className="text-sm break-all">
              <span className="text-amber-500">Source Tx:</span>
              <a 
                href={`https://sepolia.arbiscan.io/tx/${currentStake.status.sourceTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-amber-400 hover:text-amber-300"
              >
                {currentStake.status.sourceTxHash}
              </a>
            </div>
          )}

          {bridgeProtocol === 'CCIP' && currentStake.status.ccipMessageId && (
            <div className="text-sm break-all">
              <span className="text-amber-500">CCIP Message ID:</span>
              <a 
                href={`https://ccip.chain.link/msg/${currentStake.status.ccipMessageId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-amber-400 hover:text-amber-300"
              >
                {currentStake.status.ccipMessageId}
              </a>
            </div>
          )}

          {bridgeProtocol === 'CCTP' && currentStake.status.messageBytes && (
            <div className="text-sm break-all">
              <span className="text-amber-500">Message Bytes:</span>
              <span className="ml-2">{currentStake.status.messageBytes}</span>
            </div>
          )}

          {currentStake.status.destinationTxHash && (
            <div className="text-sm break-all">
              <span className="text-amber-500">Destination Tx:</span>
              <a 
                href={`https://sepolia.etherscan.io/tx/${currentStake.status.destinationTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-amber-400 hover:text-amber-300"
              >
                {currentStake.status.destinationTxHash}
              </a>
            </div>
          )}

          {bridgeProtocol === 'CCIP' && currentStake.status.bridgingMessageId && (
            <p className="text-amber-500 text-sm break-all">
              rnstETH CCIP Message ID:{" "}
              <a
                href={`https://ccip.chain.link/msg/${currentStake.status.bridgingMessageId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-amber-400 hover:text-amber-300"
              >
                {currentStake.status.bridgingMessageId}
              </a>
            </p>
          )}

          {currentStake.status.expectedTime && (
            <div className="text-sm mt-2">
              <span className="text-amber-500">Expected Time:</span>
              <span className="ml-2">{currentStake.status.expectedTime}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStakeForm = () => (
    <div className="space-y-4 p-2">
      {!currentStake?.isInProgress && renderProtocolSelector()}
      
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
          />
        </div>
      </div>
      
      <Button 
        onClick={handleStakeSubmit}
        disabled={
          stakeAmount <= 0 || 
          stakeAmount > usdcBalance || 
          currentStake?.isInProgress || 
          isApproving
        }
        fullWidth
      >
        {isApproving ? 'Approving...' :
         currentStake?.isInProgress ? 'Staking in Progress...' : 
         !hasAllowance ? `Approve for ${bridgeProtocol}` :
         `Stake with ${bridgeProtocol}`}
      </Button>

      {currentStake?.status && renderStakeStatus()}
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

      {renderStakeStatus()}

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
        <h1 className="text-2xl mb-1">Stake USDC</h1>
        <p className="text-sm opacity-70">
          Stake your USDC using {bridgeProtocol} bridge and receive rUSDC in return
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
        <Window title={`Stake USDC (${bridgeProtocol})`}>
          {stakeView === 'success' 
            ? renderSuccess()
            : renderStakeForm()
          }
        </Window>
        
        <Window title="Staking Information">
          <div className="space-y-4 p-2">
            <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
              <h3 className="text-sm font-medium mb-2">About rUSDC</h3>
              <p className="text-sm opacity-80 leading-relaxed">
                rUSDC is a token that represents your staked USDC in the Chrysalis protocol. 
                You can transfer or trade rUSDC like any other token while continuing to earn staking rewards.
              </p>
            </div>
            
            <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
              <h3 className="text-sm font-medium mb-2">Current Statistics</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-70">Total USDC Staked</span>
                  <span>24,582,410 USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Current APR</span>
                  <span className="text-green-400">4.8%</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Total Stakers</span>
                  <span>1,452</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center">
              <ArrowRightLeft size={24} className="mr-2" />
              <span className="text-sm opacity-80">1 USDC = 1 rUSDC</span>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
};

export default Stake;