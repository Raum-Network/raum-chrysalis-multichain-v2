import { useState } from 'react';
import { useWallet } from '../lib/walletConnect';
import Button from '../components/Button';
import Window from '../components/Window';
import AmountInput from '../components/AmountInput';
import { ArrowRightLeft, Loader2, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Stake = () => {
  const { isConnected, balance, connect } = useWallet();
  const [stakeAmount, setStakeAmount] = useState(0);
  const [stakeView, setStakeView] = useState<'form' | 'confirming' | 'success'>('form');
  const [transactionHash, setTransactionHash] = useState('');
  
  const handleStakeSubmit = () => {
    if (stakeAmount <= 0) return;
    setStakeView('confirming');
    
    // Simulate transaction confirmation
    setTimeout(() => {
      setTransactionHash('0x' + Math.random().toString(16).substr(2, 40));
      setStakeView('success');
    }, 2000);
  };
  
  const resetForm = () => {
    setStakeAmount(0);
    setStakeView('form');
    setTransactionHash('');
  };
  
  const renderStakeForm = () => (
    <div className="space-y-4 p-2">
      <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm opacity-70">Available</span>
          <span>{balance} ETH</span>
        </div>
        <div className="border-t border-amber-700/30 pt-3 mt-2">
          <AmountInput
            value={stakeAmount}
            onChange={setStakeAmount}
            min={0}
            max={Number(balance)}
            step={0.01}
            label="Stake Amount"
            suffix="ETH"
          />
        </div>
        
        <div className="flex justify-between text-xs mt-4">
          <span className="opacity-70">You will receive</span>
          <span>{stakeAmount.toFixed(4)} rETH</span>
        </div>
      </div>
      
      <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
        <h3 className="text-sm font-medium mb-2">Staking Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="opacity-70">Amount to stake</span>
            <span>{stakeAmount.toFixed(4)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Exchange rate</span>
            <span>1 ETH = 1 rETH</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Current APR</span>
            <span className="text-green-400">4.8%</span>
          </div>
          <div className="border-t border-amber-700/30 pt-2 mt-1">
            <div className="flex justify-between font-medium">
              <span>You will receive</span>
              <span>{stakeAmount.toFixed(4)} rETH</span>
            </div>
          </div>
        </div>
      </div>
      
      <Button 
        onClick={handleStakeSubmit}
        disabled={stakeAmount <= 0 || stakeAmount > Number(balance)}
        fullWidth
      >
        Stake ETH
      </Button>
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
    <div className="p-4 flex flex-col items-center justify-center">
      <motion.div 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="mb-6 text-green-400"
      >
        <CheckCircle2 size={48} />
      </motion.div>
      <h3 className="text-xl mb-2">Staking Successful</h3>
      <p className="text-sm opacity-70 text-center mb-4">
        You have successfully staked {stakeAmount.toFixed(4)} ETH
      </p>
      <div className="flex flex-col space-y-2 w-full">
        <Button onClick={resetForm} variant="secondary">
          Stake More
        </Button>
        <Button onClick={() => window.location.href = '/dashboard'} variant="primary">
          Go to Dashboard
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
        <h1 className="text-2xl mb-1">Stake ETH</h1>
        <p className="text-sm opacity-70">Stake your ETH and receive rETH in return</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Window title="Stake ETH">
          {stakeView === 'form' && renderStakeForm()}
          {stakeView === 'confirming' && renderConfirming()}
          {stakeView === 'success' && renderSuccess()}
        </Window>
        
        <Window title="Staking Information">
          <div className="space-y-4 p-2">
            <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
              <h3 className="text-sm font-medium mb-2">About rETH</h3>
              <p className="text-sm opacity-80 leading-relaxed">
                rETH is a token that represents your staked ETH in the Chrysalis protocol. 
                You can transfer or trade rETH like any other token while continuing to earn staking rewards.
              </p>
            </div>
            
            <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
              <h3 className="text-sm font-medium mb-2">Current Statistics</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-70">Total ETH Staked</span>
                  <span>24,582.41 ETH</span>
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
              <span className="text-sm opacity-80">1 ETH = 1 rETH</span>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
};

export default Stake;