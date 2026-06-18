import { useMemo, useEffect, useState } from 'react';
import { useWallet } from '../lib/walletConnect';
import Window from '../components/Window';
import Terminal from '../components/Terminal';
import Button from '../components/Button';
import { CreditCard, BarChart3, Clock, ChevronRight, ShieldCheck, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import stakedUserBalance from '../lib/sepoliaContract';
import { getLidoAPY } from '../services/api';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import ReactGA from 'react-ga4';
import { useStaking } from '../hooks/useStaking';

const Dashboard = () => {
  const { usdcBalance, stakingNFTs, solanaStakingNFTs, supportedProtocols, assetSymbol } = useStaking();
  const { isConnected, address, chainId, networkConfig } = useWallet();
  const [stakedBalance, setStakedBalance] = useState<string>('0');
  const [lidoAPY, setLidoAPY] = useState<number | null>(null);
  const isRippleNetwork = supportedProtocols.includes('Axelar ITS');
  const isSolanaNetwork = networkConfig.chainFamily === 'solana';
  const receiptNFTs = isSolanaNetwork
    ? solanaStakingNFTs.map((item) => ({ id: item.id, receipt: item.receipt }))
    : stakingNFTs;

  useEffect(() => {
    if (address) {
      ReactGA.event({
        category: 'Wallet',
        action: 'Click',
        label: `Connected Wallet ${address}`
      });
    }
  }, [address]);

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
          const balance = await stakedUserBalance.getBalance(address);
          const cctpBalance = await stakedUserBalance.getBalanceCCTP(address);
          setStakedBalance((Number(balance) + Number(cctpBalance)).toString());
        } catch (error) {
          console.error('Error updating staked balance:', error);
        }
      }
    };

    const unsubscribe = stakeManager.subscribeToStatus(handleStakeUpdate);
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
  ] as Array<{
    message: string;
    type: 'success' | 'info' | 'error' | 'warning' | 'command' | 'loading';
    timestamp: Date;
  }>, []);

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

  const stakingData = {
    stakedAmount: parseFloat(stakedBalance),
    apr: lidoAPY || 4.8,
    nextReward: '--'
  };

  const metricCards = [
    {
      title: 'Staked position',
      value: `${stakingData.stakedAmount.toFixed(4)} ${isRippleNetwork ? 'stETH' : 'ETH'}`,
      icon: <CreditCard size={18} />,
      hint: 'Destination-side live balance'
    },
    {
      title: `Wallet ${assetSymbol}`,
      value: `${parseFloat(usdcBalance.toString()).toFixed(4)} ${assetSymbol}`,
      icon: <Landmark size={18} />,
      hint: 'Available to deposit'
    },
    {
      title: 'Reference APR',
      value: `${stakingData.apr.toFixed(2)}%`,
      icon: <BarChart3 size={18} />,
      hint: 'Pulled from the Lido feed'
    },
    {
      title: 'Next reward window',
      value: stakingData.nextReward,
      icon: <Clock size={18} />,
      hint: 'Settles after destination execution'
    }
  ];

  return (
    <div className="route-scroll">
      <div className="page-canvas page-grid page-wide lg:grid-rows-[auto_auto_minmax(0,1fr)]">
        <section className="premium-surface rounded-[32px] p-5 sm:p-6">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div>
              <div className="eyebrow">Portfolio command center</div>
              <h1 className="mt-4 text-4xl font-semibold">Dashboard</h1>
              <p className="muted-copy mt-3 max-w-2xl text-base leading-7">
                Review staking balances, routing support, and execution health for the active network without losing protocol context.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="premium-pill rounded-full px-3 py-1.5">{networkConfig.name}</span>
                <span className="premium-card rounded-full px-3 py-1.5">{supportedProtocols.join(' / ')}</span>
                <span className="premium-card rounded-full px-3 py-1.5">Asset: {assetSymbol}</span>
              </div>
            </div>
            <div className="flex justify-start xl:justify-end">
              <Link to="/stake">
                <Button size="lg" icon={<ChevronRight size={16} />}>
                  Stake More
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <div key={metric.title} className="premium-card rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">{metric.title}</div>
                  <div className="mt-3 text-2xl font-semibold">{metric.value}</div>
                  <div className="muted-copy mt-2 text-sm">{metric.hint}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(var(--accent),0.1)] text-[rgb(var(--accent-strong))]">
                  {metric.icon}
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid min-h-0 gap-4 lg:grid-cols-[1.15fr_0.95fr]">
          <Window title="Network Capability Matrix">
            <div className="flex h-full min-h-0 flex-col">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="premium-card rounded-[24px] p-4">
                  <div className="eyebrow">Active network</div>
                  <div className="mt-3 text-base font-semibold">{networkConfig.name}</div>
                </div>
                <div className="premium-card rounded-[24px] p-4">
                  <div className="eyebrow">Supported protocols</div>
                  <div className="mt-3 text-base font-semibold">{supportedProtocols.join(', ')}</div>
                </div>
                <div className="premium-card rounded-[24px] p-4">
                  <div className="eyebrow">Staking asset</div>
                  <div className="mt-3 text-base font-semibold">{assetSymbol}</div>
                </div>
              </div>
              <div className="premium-card mt-4 flex items-center gap-3 rounded-[24px] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(var(--success),0.12)] text-emerald-600">
                  <ShieldCheck size={18} />
                </div>
                <p className="text-sm">
                  Protocol support and explorer resolution are derived from the network configuration for the current session.
                </p>
              </div>
            </div>
          </Window>

          <Window title="Operations Feed" className="min-h-0">
            <Terminal logs={initialLogs} interactive={true} className="h-full" />
          </Window>
        </section>

        {(isRippleNetwork || isSolanaNetwork) && receiptNFTs.length > 0 && (
          <Window title="Minted Staking Receipts">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {receiptNFTs.map((item) => (
                <div key={item.id} className="premium-card relative overflow-hidden rounded-[26px] p-5">
                  <div className="absolute right-0 top-0 rounded-bl-2xl bg-[rgba(var(--accent),0.12)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--accent-strong))]">
                    {item.id.substring(0, 8)}...
                  </div>
                  <h3 className="pr-16 text-sm font-semibold">{item.receipt.pool}</h3>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-3xl font-semibold">{item.receipt.amount}</span>
                    <span className="rounded-full bg-black/5 px-2 py-1 text-xs font-semibold">{item.receipt.token}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 border-t border-black/5 pt-4 text-xs">
                    <div>
                      <div className="muted-copy">Staked on</div>
                      <div className="mt-1 font-semibold">{new Date(item.receipt.stakedAt * 1000).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="muted-copy">Minted</div>
                      <div className="mt-1 font-semibold text-emerald-600">
                        {item.receipt.mintedStETH !== '0' ? `${item.receipt.mintedStETH} stETH` : 'Pending'}
                      </div>
                    </div>
                    <div>
                      <div className="muted-copy">APY</div>
                      <div className="mt-1 font-semibold">{item.receipt.apy}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Window>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
