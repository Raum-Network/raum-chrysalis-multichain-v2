import { useMemo, useEffect, useState } from 'react';
import { useWallet } from '../lib/walletConnect';
import Window from '../components/Window';
import StatBox from '../components/StatBox';
import Terminal from '../components/Terminal';
import Button from '../components/Button';
import ProgressBar from '../components/ProgressBar';
import TierCard from '../components/TierCard';
import { CreditCard, DollarSign, BarChart3, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import stakedUserBalance from '../lib/sepoliaContract';
import { getLidoAPY } from '../services/api';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import { useStaking } from '../hooks/useStaking';


const Dashboard = () => {
  const {usdcBalance} =  useStaking();
  const { isConnected, address, balance, connect } = useWallet();
  const [stakedBalance, setStakedBalance] = useState<string>('0');
  const [lidoAPY, setLidoAPY] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (address) {
        try {
          const balance = await stakedUserBalance.getBalance(address);
          const cctpBalance = await stakedUserBalance.getBalanceCCTP(address);
          
          setStakedBalance((Number(balance) + Number(cctpBalance)).toString());
          
          const apy = await getLidoAPY();
          console.log(apy);
          setLidoAPY(apy);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [address]);

  useEffect(() => {
    const handleStakeUpdate = async (status: StakeStatus) => {
      if (status.destinationTxHash && address) {
        try {
          // Fetch updated balances
          const balance = await stakedUserBalance.getBalance(address);
          const cctpBalance = await stakedUserBalance.getBalanceCCTP(address);
          
          // Update staked balance
          setStakedBalance((Number(balance) + Number(cctpBalance)).toString());
        } catch (error) {
          console.error('Error updating staked balance:', error);
        }
      }
    };

    // Subscribe to stake status updates
    const unsubscribe = stakeManager.subscribeToStatus(handleStakeUpdate);

    // Cleanup subscription
    return () => unsubscribe();
  }, [address]);

  const initialLogs = useMemo(() => [
    {
      message: 'Dashboard initialized',
      type: 'success',
      timestamp: new Date()
    },
    {
      message: 'Fetching staking data...',
      type: 'success',
      timestamp: new Date()
    },
    {
      message: 'Data loaded successfully',
      type: 'success',
      timestamp: new Date()
    }
  ] as any[], []);

  // Mocked staking data
  const stakingData = {
    stakedAmount: parseFloat(stakedBalance),
    totalRewards: 0.125,
    apr: lidoAPY || 4.8,
    nextReward: '3d 14h',
    stakers: 1452,
    totalStaked: 24582
  };

  const tiers = [
    {
      name: 'Bronze',
      icon: 'bronze' as const,
      minAmount: 1,
      apr: 4.8,
      benefits: [
        'Basic staking rewards',
        'Weekly rewards distribution',
        'Dashboard access'
      ],
      color: 'amber'
    },
    {
      name: 'Silver',
      icon: 'silver' as const,
      minAmount: 10,
      apr: 5.2,
      benefits: [
        'Enhanced staking rewards',
        'Priority support',
        'Early access to new features',
        'Voting rights'
      ],
      color: 'gray'
    },
    {
      name: 'Gold',
      icon: 'gold' as const,
      minAmount: 32,
      apr: 5.8,
      benefits: [
        'Premium staking rewards',
        'Exclusive community access',
        'Governance participation',
        'Beta feature testing',
        'Monthly strategy calls'
      ],
      color: 'yellow'
    },
    {
      name: 'Platinum',
      icon: 'platinum' as const,
      minAmount: 100,
      apr: 6.5,
      benefits: [
        'Maximum staking rewards',
        'Direct team access',
        'Custom analytics dashboard',
        'Private discord channel',
        'Quarterly strategy sessions',
        'Early product access'
      ],
      color: 'purple'
    }
  ];
  
  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center mb-6">
          <h1 className="text-2xl mb-2">Connect Your Wallet</h1>
          <p className="opacity-70">Please connect your wallet to view your dashboard</p>
        </div>
        <Button onClick={connect} size="lg">Connect Wallet</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl mb-1">Dashboard</h1>
          <p className="text-sm opacity-70">Overview of your staking performance</p>
        </div>
        <div className="mt-2 md:mt-0 flex space-x-2">
          <Link to="/stake">
            <Button variant="primary">
              Stake More
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatBox 
          title="Your Staked Asset" 
          value={stakingData.stakedAmount.toFixed(4)} 
          suffix="ETH"
          icon={<CreditCard size={18} />} 
          change={{ value: 2.5, isPositive: true }}
        />
        <StatBox 
          title="Your Rewards" 
          value={stakingData.totalRewards} 
          suffix="ETH"
          icon={<DollarSign size={18} />} 
          change={{ value: 5.2, isPositive: true }}
        />
        <StatBox 
          title="Current APR" 
          value={`${stakingData.apr}%`}
          icon={<BarChart3 size={18} />} 
          change={{ value: 0.3, isPositive: true }}
        />
        <StatBox 
          title="Next Reward" 
          value={stakingData.nextReward}
          icon={<Clock size={18} />} 
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
        <Window title="Staking Summary" className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-amber-700/30 rounded-md p-3 bg-amber-900/20">
              <h3 className="text-sm mb-2">Your Staking Balance</h3>
              <div className="flex items-end mb-3">
                <span className="text-2xl font-medium">{stakingData.stakedAmount.toFixed(4)}</span>
                <span className="ml-1 text-sm opacity-70">ETH</span>
              </div>
              {/* <ProgressBar value={stakingData.stakedAmount} max={10} /> */}
              
              <div className="mt-4">
                <h4 className="text-xs opacity-70 mb-1">Available to Stake</h4>
                <div className="flex items-end">
                  <span className="text-lg">{usdcBalance}</span>
                  <span className="ml-1 text-xs opacity-70">USDC</span>
                </div>
              </div>
            </div>
            
            <div className="border border-amber-700/30 rounded-md p-3 bg-amber-900/20">
              <h3 className="text-sm mb-2">Rewards Overview</h3>
              <div className="flex items-end mb-3">
                <span className="text-2xl font-medium">{stakingData.totalRewards}</span>
                <span className="ml-1 text-sm opacity-70">ETH</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Current Rate</h4>
                  <div className="text-lg">{stakingData.apr}%</div>
                </div>
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Next Reward</h4>
                  <div className="text-lg">{stakingData.nextReward}</div>
                </div>
              </div>
            </div>
            
            <div className="border border-amber-700/30 rounded-md p-3 bg-amber-900/20 sm:col-span-2">
              <h3 className="text-sm mb-2">Protocol Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Total Stakers</h4>
                  <div className="text-lg">{stakingData.stakers.toLocaleString()}</div>
                </div>
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Total ETH Staked</h4>
                  <div className="text-lg">{stakingData.totalStaked.toLocaleString()}</div>
                </div>
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Protocol Health</h4>
                  <div className="text-lg text-green-400">Excellent</div>
                </div>
              </div>
            </div>
          </div>
        </Window>
        
        <Window title="Activity Log">
          <Terminal logs={initialLogs} interactive={true} />
        </Window>
      </div>
    </div>
  );
};

export default Dashboard;