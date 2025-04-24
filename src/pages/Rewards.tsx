import { useState } from 'react';
import { useWallet } from '../lib/walletConnect';
import Button from '../components/Button';
import Window from '../components/Window';
import { DollarSign, Clock, History, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Rewards = () => {
  const { isConnected, connect } = useWallet();
  const [claimView, setClaimView] = useState<'overview' | 'claiming' | 'success'>('overview');
  
  // Mock rewards data
  const rewardsData = {
    totalRewards: 0.125,
    pendingRewards: 0.042,
    nextDistribution: '3d 14h',
    claimHistory: [
      { date: '2025-03-15', amount: 0.018, status: 'Claimed' },
      { date: '2025-03-08', amount: 0.021, status: 'Claimed' },
      { date: '2025-03-01', amount: 0.014, status: 'Claimed' },
      { date: '2025-02-22', amount: 0.030, status: 'Claimed' },
    ]
  };
  
  const handleClaimRewards = () => {
    setClaimView('claiming');
    
    // Simulate transaction
    setTimeout(() => {
      setClaimView('success');
    }, 2000);
  };
  
  const resetClaim = () => {
    setClaimView('overview');
  };
  
  const renderRewardsOverview = () => (
    <div className="space-y-4 p-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
          <DollarSign size={18} className="mb-1 text-green-400" />
          <h3 className="text-sm opacity-70 mb-1">Pending Rewards</h3>
          <div className="flex items-end">
            <span className="text-2xl font-medium">{rewardsData.pendingRewards}</span>
            <span className="ml-1 text-sm opacity-70">ETH</span>
          </div>
          <Button 
            onClick={handleClaimRewards} 
            variant="success" 
            size="sm" 
            className="mt-3 w-full"
            disabled={rewardsData.pendingRewards <= 0}
          >
            Claim Rewards
          </Button>
        </div>
        
        <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
          <Clock size={18} className="mb-1 text-amber-400" />
          <h3 className="text-sm opacity-70 mb-1">Next Distribution</h3>
          <div className="text-2xl font-medium">{rewardsData.nextDistribution}</div>
          <div className="text-xs opacity-70 mt-2">
            Rewards are distributed weekly and can be claimed at any time
          </div>
        </div>
      </div>
      
      <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
        <div className="flex items-center mb-2">
          <History size={16} className="mr-2" />
          <h3 className="text-sm font-medium">Rewards History</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs opacity-70 pb-1 border-b border-amber-700/30">
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          {rewardsData.claimHistory.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>{item.date}</span>
              <span>{item.amount.toFixed(4)} ETH</span>
              <span className="text-green-400">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
        <h3 className="text-sm font-medium mb-2">Total Rewards to Date</h3>
        <div className="flex items-end">
          <span className="text-2xl font-medium">{rewardsData.totalRewards}</span>
          <span className="ml-1 text-sm opacity-70">ETH</span>
        </div>
      </div>
    </div>
  );
  
  const renderClaiming = () => (
    <div className="p-4 flex flex-col items-center justify-center">
      <div className="mb-6">
        <Loader2 size={48} className="animate-spin text-green-500" />
      </div>
      <h3 className="text-xl mb-2">Claiming Rewards</h3>
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
      <h3 className="text-xl mb-2">Rewards Claimed</h3>
      <p className="text-sm opacity-70 text-center mb-4">
        You have successfully claimed {rewardsData.pendingRewards.toFixed(4)} ETH in rewards
      </p>
      <div className="flex flex-col space-y-2 w-full">
        <Button onClick={resetClaim} variant="primary">
          Back to Rewards
        </Button>
        <Button onClick={() => window.location.href = '/dashboard'} variant="secondary">
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
          <p className="opacity-70">Please connect your wallet to view rewards</p>
        </div>
        <Button onClick={connect} size="lg">Connect Wallet</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Rewards</h1>
        <p className="text-sm opacity-70">View and claim your staking rewards</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Window title="Your Rewards">
          {claimView === 'overview' && renderRewardsOverview()}
          {claimView === 'claiming' && renderClaiming()}
          {claimView === 'success' && renderSuccess()}
        </Window>
        
        <Window title="Rewards Information">
          <div className="space-y-4 p-2">
            <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
              <h3 className="text-sm font-medium mb-2">About Rewards</h3>
              <p className="text-sm opacity-80 leading-relaxed">
                Staking rewards are earned by validating transactions on the network. 
                Your rewards accrue automatically while your ETH is staked, and you can claim them at any time.
              </p>
            </div>
            
            <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
              <h3 className="text-sm font-medium mb-2">Reward Schedule</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-70">Distribution</span>
                  <span>Weekly</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Current APR</span>
                  <span className="text-green-400">4.8%</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Claim Fee</span>
                  <span>None</span>
                </div>
              </div>
            </div>
            
            <div className="p-3 rounded-md border border-amber-700/40 bg-amber-900/10">
              <h3 className="text-sm font-medium mb-2">Reward Calculation</h3>
              <p className="text-sm opacity-80 leading-relaxed">
                Rewards are calculated based on your staked amount and the current APR.
                The formula is: <code>Staked ETH × APR ÷ 365 × Days</code>
              </p>
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
};

export default Rewards;