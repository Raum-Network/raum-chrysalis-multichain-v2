import { useMemo, useEffect, useState } from 'react';
import { useWallet } from '../lib/walletConnect';
import Window from '../components/Window';
import StatBox from '../components/StatBox';
import Terminal from '../components/Terminal';
import Button from '../components/Button';
import { CreditCard, DollarSign, BarChart3, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import stakedUserBalance from '../lib/sepoliaContract';
import { getLidoAPY } from '../services/api';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import { ConnectKitButton } from 'connectkit';
import ReactGA from 'react-ga4';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Buffer } from "buffer";

import { useStaking } from '../hooks/useStaking';

const Dashboard = () => {
  const { usdcBalance, stakingNFTs } = useStaking();
  const { isConnected, address, chainId, networkConfig } = useWallet();
  const [stakedBalance, setStakedBalance] = useState<string>('0');
  const [lidoAPY, setLidoAPY] = useState<number | null>(null);

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
    const fetchData = async () => {
      if (address) {
        try {
          const balance = await stakedUserBalance.getBalance(address);
          const cctpBalance = await stakedUserBalance.getBalanceCCTP(address);

          setStakedBalance((Number(balance) + Number(cctpBalance)).toString());

          const apy = await getLidoAPY();
          setLidoAPY(apy);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [address, chainId]);

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
      message: 'Type "help" to see available commands',
      type: 'success',
      timestamp: new Date()
    }
  ] as any[], []);

  // Dynamic XRPL NFT Data Aggregation
  const totalMintedStETH = useMemo(() => {
    return stakingNFTs.reduce((total, item) => {
      return total + Number(item.receipt.mintedStETH || 0);
    }, 0);
  }, [stakingNFTs]);

  // Mocked staking data
  const stakingData = {
    stakedAmount: networkConfig.name === 'Stellar Testnet' ? parseFloat(stakedBalance) : parseFloat(stakedBalance),
    totalRewards: 0.125,
    apr: networkConfig.name === 'Stellar Testnet' ? lidoAPY : (lidoAPY || 4.8),
    nextReward: '3d 14h',
    stakers: 1452,
    totalStaked: 24582
  };

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center mb-6">
          <h1 className="text-2xl mb-2">Connect Your Wallet</h1>
          <p className="opacity-70">Please connect your wallet to view your dashboard</p>
        </div>
        <ConnectKitButton.Custom>
          {({ show }) => (
            <Button onClick={() => {

              show?.();
            }} size="lg">
              Connect Wallet
            </Button>
          )}
        </ConnectKitButton.Custom>
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
          suffix={networkConfig.name === 'Stellar Testnet' ? 'stETH' : 'ETH'}
          icon={<CreditCard size={18} />}
        // change={{ value: 2.5, isPositive: true }}
        />
        <StatBox
          title="Your Rewards"
          value="--"
          suffix="ETH"
          icon={<DollarSign size={18} />}
        // change={{ value: 5.2, isPositive: true }}
        />
        <StatBox
          title="Current APR"
          value={`${stakingData.apr}%`}
          icon={<BarChart3 size={18} />}
        // change={{ value: 0.3, isPositive: true }}
        />
        <StatBox
          title="Next Reward"
          value="--"
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
                <span className="ml-1 text-sm opacity-70">{networkConfig.name === 'Stellar Testnet' ? 'stETH' : 'ETH'}</span>
              </div>
              {/* <ProgressBar value={stakingData.stakedAmount} max={10} /> */}

              <div className="mt-4">
                <h4 className="text-xs opacity-70 mb-1">Available to Stake</h4>
                <div className="flex items-end">
                  <span className="text-lg">{usdcBalance}</span>
                  <span className="ml-1 text-xs opacity-70">{networkConfig.name === 'Stellar Testnet' ? 'XRP' : 'USDC'}</span>
                </div>
              </div>
            </div>

            <div className="border border-amber-700/30 rounded-md p-3 bg-amber-900/20">
              <h3 className="text-sm mb-2">Rewards Overview</h3>
              <div className="flex items-end mb-3">
                <span className="text-2xl font-medium">--</span>
                <span className="ml-1 text-sm opacity-70"></span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Current Rate</h4>
                  <div className="text-lg">{`${stakingData.apr}%`}</div>
                </div>
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Next Reward</h4>
                  <div className="text-lg">--</div>
                </div>
              </div>
            </div>

            <div className="border border-amber-700/30 rounded-md p-3 bg-amber-900/20 sm:col-span-2">
              <h3 className="text-sm mb-2">Protocol Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Total Stakers</h4>
                  <div className="text-lg">--</div>
                </div>
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Total ETH Staked</h4>
                  <div className="text-lg">--</div>
                </div>
                <div>
                  <h4 className="text-xs opacity-70 mb-1">Protocol Health</h4>
                  <div className="text-lg text-green-400">Excellent</div>
                </div>
              </div>
            </div>
          </div>
        </Window>

        <Window title="Activity Console">
          <Terminal logs={initialLogs} interactive={true} />
        </Window>
      </div>

      {networkConfig.name === 'Stellar Testnet' && stakingNFTs.length > 0 && (
        <div className="mt-4">
          <Window title="Your Minted Staking Receipts (XRPL NFTs)">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {stakingNFTs.map((item) => (
                <div key={item.id} className="border border-amber-700/50 hover:bg-amber-900/30 transition-colors rounded-md p-4 bg-amber-900/20 flex flex-col relative overflow-hidden backdrop-blur-sm">
                  <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-300 text-[9px] px-2 py-1 rounded-bl-md font-mono border-l border-b border-amber-500/20">
                    {item.id.substring(0, 8)}...
                  </div>
                  <h3 className="text-sm font-medium text-amber-400 mb-1 truncate pr-16">{item.receipt.pool}</h3>
                  <div className="flex items-end mb-3">
                    <span className="text-2xl font-semibold tracking-tight">{item.receipt.amount}</span>
                    <span className="ml-1.5 text-sm opacity-80 mb-1 font-medium bg-amber-900/50 px-1.5 py-0.5 rounded text-amber-200">{item.receipt.token}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs opacity-70 mt-auto pt-3 border-t border-amber-700/40">
                    <div>
                      <div className="mb-0.5 uppercase tracking-wider text-[10px] opacity-70">Staked On</div>
                      <div className="font-medium">{new Date(item.receipt.stakedAt * 1000).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="mb-0.5 uppercase tracking-wider text-[10px] opacity-70">Minted</div>
                      <div className="font-medium text-emerald-400">{item.receipt.mintedStETH !== "0" ? `${item.receipt.mintedStETH} stETH` : "Pending"}</div>
                    </div>
                    <div>
                      <div className="mb-0.5 uppercase tracking-wider text-[10px] opacity-70">Current APY</div>
                      <div className="font-medium text-amber-400">{item.receipt.apy}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Window>
        </div>
      )}
    </div>
  );
};

export default Dashboard;