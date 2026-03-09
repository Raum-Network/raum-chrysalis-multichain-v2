import { useState } from 'react';
import { useWallet } from '../lib/walletConnect';
import Button from '../components/Button';
import Window from '../components/Window';
import { DollarSign, Clock, History, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const Rewards = () => {
  const { isConnected, connect } = useWallet();
  const [claimView, setClaimView] = useState<'overview' | 'claiming' | 'success'>('overview');

  const rewardsData = {
    totalRewards: 0.125,
    pendingRewards: 0.042,
    nextDistribution: '3d 14h',
    claimHistory: [
      { date: '2025-03-15', amount: 0.018, status: 'Claimed' },
      { date: '2025-03-08', amount: 0.021, status: 'Claimed' },
      { date: '2025-03-01', amount: 0.014, status: 'Claimed' },
      { date: '2025-02-22', amount: 0.03, status: 'Claimed' },
    ]
  };

  const handleClaimRewards = () => {
    setClaimView('claiming');
    setTimeout(() => {
      setClaimView('success');
    }, 2000);
  };

  const resetClaim = () => {
    setClaimView('overview');
  };

  const renderRewardsOverview = () => (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="premium-card rounded-[26px] p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow">Pending rewards</div>
              <div className="mt-4 text-4xl font-semibold">{rewardsData.pendingRewards}</div>
              <div className="muted-copy mt-1 text-sm">ETH available to claim</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(var(--success),0.14)] text-emerald-600">
              <DollarSign size={18} />
            </div>
          </div>
          <Button
            onClick={handleClaimRewards}
            variant="success"
            size="md"
            className="mt-6 w-full"
            disabled={rewardsData.pendingRewards <= 0}
          >
            Claim Rewards
          </Button>
        </div>

        <div className="premium-card rounded-[26px] p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow">Next distribution</div>
              <div className="mt-4 text-4xl font-semibold">{rewardsData.nextDistribution}</div>
              <div className="muted-copy mt-1 text-sm">Weekly distribution cadence</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(var(--signal),0.14)] text-[rgb(var(--signal))]">
              <Clock size={18} />
            </div>
          </div>
        </div>
      </div>

      <div className="premium-card rounded-[26px] p-5">
        <div className="mb-4 flex items-center gap-2">
          <History size={16} />
          <h3 className="text-sm font-semibold">Claim history</h3>
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-3 border-b border-black/5 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] muted-copy">
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          {rewardsData.claimHistory.map((item, index) => (
            <div key={index} className="grid grid-cols-3 rounded-2xl border border-black/5 px-3 py-3 text-sm">
              <span>{item.date}</span>
              <span>{item.amount.toFixed(4)} ETH</span>
              <span className="text-emerald-600">{item.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="premium-card rounded-[26px] p-5">
        <div className="eyebrow">Total rewards to date</div>
        <div className="mt-4 text-4xl font-semibold">{rewardsData.totalRewards}</div>
        <div className="muted-copy mt-1 text-sm">ETH accrued across settled positions</div>
      </div>
    </div>
  );

  const renderClaiming = () => (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <Loader2 size={44} className="animate-spin text-[rgb(var(--accent-strong))]" />
      <h3 className="mt-6 text-2xl font-semibold">Claiming rewards</h3>
      <p className="muted-copy mt-2 max-w-md text-sm">Confirm the reward claim transaction in your wallet to continue.</p>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[rgba(var(--success),0.16)] text-emerald-600">
          <CheckCircle2 size={34} />
        </div>
      </motion.div>
      <h3 className="mt-6 text-2xl font-semibold">Rewards claimed</h3>
      <p className="muted-copy mt-2 max-w-md text-sm">
        {rewardsData.pendingRewards.toFixed(4)} ETH has been marked as claimed in the current rewards view.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        <Button onClick={resetClaim}>Back to Rewards</Button>
        <Button onClick={() => window.location.href = '/dashboard'} variant="secondary">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );

  if (!isConnected) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="premium-surface max-w-xl rounded-[32px] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[rgba(var(--accent),0.12)] text-[rgb(var(--accent-strong))]">
            <Sparkles size={22} />
          </div>
          <h1 className="mt-5 text-3xl font-semibold">Connect your wallet</h1>
          <p className="muted-copy mt-2 text-sm">Rewards are tied to the active wallet session and staking receipts.</p>
          <Button onClick={() => void connect()} size="lg" className="mt-6">Connect Wallet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="route-scroll">
      <div className="page-canvas page-grid lg:grid-rows-[auto_minmax(0,1fr)]">
      <section className="premium-surface rounded-[32px] p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="eyebrow">Yield settlement</div>
            <h1 className="mt-4 text-4xl font-semibold">Rewards</h1>
            <p className="muted-copy mt-3 max-w-2xl text-base leading-7">
              Review accrued staking rewards, distribution cadence, and recent claim history without changing your underlying position.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="premium-card rounded-[24px] p-4">
              <div className="eyebrow">Pending</div>
              <div className="mt-3 text-2xl font-semibold">{rewardsData.pendingRewards} ETH</div>
            </div>
            <div className="premium-card rounded-[24px] p-4">
              <div className="eyebrow">All-time</div>
              <div className="mt-3 text-2xl font-semibold">{rewardsData.totalRewards} ETH</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-h-0 gap-4 lg:grid-cols-2">
        <Window title="Rewards Ledger">
          {claimView === 'overview' && renderRewardsOverview()}
          {claimView === 'claiming' && renderClaiming()}
          {claimView === 'success' && renderSuccess()}
        </Window>

        <Window title="Rewards Context">
          <div className="grid gap-4">
            <div className="premium-card rounded-[24px] p-5">
              <h3 className="text-sm font-semibold">About rewards</h3>
              <p className="muted-copy mt-3 text-sm leading-6">
                Rewards continue to accrue while the staking position remains active. Claiming changes the reward ledger view, not the principal itself.
              </p>
            </div>

            <div className="premium-card rounded-[24px] p-5">
              <h3 className="text-sm font-semibold">Schedule</h3>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="muted-copy">Distribution</span>
                  <span className="font-semibold">Weekly</span>
                </div>
                <div className="flex justify-between">
                  <span className="muted-copy">Reference APR</span>
                  <span className="font-semibold text-emerald-600">4.8%</span>
                </div>
                <div className="flex justify-between">
                  <span className="muted-copy">Claim fee</span>
                  <span className="font-semibold">None</span>
                </div>
              </div>
            </div>

            <div className="premium-card rounded-[24px] p-5">
              <h3 className="text-sm font-semibold">Estimation formula</h3>
              <p className="muted-copy mt-3 text-sm leading-6">
                Rewards estimate:
                <span className="ml-1 font-mono">Staked ETH x APR / 365 x Days</span>
              </p>
            </div>
          </div>
        </Window>
      </div>
      </div>
    </div>
  );
};

export default Rewards;
