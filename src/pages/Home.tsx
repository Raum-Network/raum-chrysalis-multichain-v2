import { ArrowRight, ArrowUpRight, Orbit, ShieldCheck, SplitSquareVertical, Waves } from 'lucide-react';
import Button from '../components/Button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useWallet } from '../lib/walletConnect';
import Terminal from '../components/Terminal';
import ReactGA from 'react-ga4';
import { useEffect } from 'react';

const Home = () => {
  const { isConnected, address, networkConfig } = useWallet();

  const terminalLogs: { message: string; type: 'success' | 'info' | 'error' | 'warning' | 'command'; timestamp: Date }[] = [
    {
      message: 'Chrysalis orchestration layer ready',
      type: 'success',
      timestamp: new Date()
    },
    {
      message: `Network context loaded: ${networkConfig.name}`,
      type: 'info',
      timestamp: new Date()
    },
    {
      message: 'Routing matrix available for stake and transaction flows',
      type: 'success',
      timestamp: new Date()
    }
  ];

  useEffect(() => {
    if (address) {
      ReactGA.event({
        category: 'Wallet',
        action: 'Click',
        label: `Connected Wallet ${address}`
      });
    }
  }, [address]);

  const featureCards = [
    {
      title: 'Protocol-aware routing',
      copy: 'Stake through CCIP, CCTP, or Axelar ITS based on the network capability matrix.',
      icon: <SplitSquareVertical size={18} />
    },
    {
      title: 'Live execution visibility',
      copy: 'Source, message, attestation, and destination status stay visible as the bridge flow progresses.',
      icon: <Orbit size={18} />
    },
    {
      title: 'Minimal operator UX',
      copy: 'The interface keeps the flow readable under load without hiding protocol or asset context.',
      icon: <Waves size={18} />
    },
    {
      title: 'Guarded by network config',
      copy: 'Supported protocols, assets, and explorer links are derived from config rather than hardcoded page rules.',
      icon: <ShieldCheck size={18} />
    }
  ];

  return (
    <div className="route-scroll">
      <div className="page-canvas page-grid page-wide lg:grid-rows-[minmax(0,1fr)_auto]">
      <section className="grid min-h-0 gap-4 xl:grid-cols-[1.3fr_0.8fr]">
        <motion.div
          className="premium-surface soft-grid h-full rounded-[32px] p-5 sm:p-6"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="max-w-3xl">
            <div className="eyebrow">Cross-chain liquid staking</div>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.02] sm:text-5xl lg:text-[3.35rem]">
              A cleaner control surface for multi-protocol staking.
            </h1>
            <p className="muted-copy mt-4 max-w-2xl text-base leading-7">
              Chrysalis keeps the staking workflow intact while making protocol support, network context, balances, and execution state easier to read across CCIP, CCTP, and Ripple flows.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="premium-pill rounded-full px-3 py-1.5 text-xs font-semibold">Active network: {networkConfig.name}</div>
              <div className="premium-card rounded-full px-3 py-1.5 text-xs font-semibold">Protocol-specific status tracking</div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {isConnected ? (
                <Link to="/dashboard">
                  <Button size="lg" icon={<ArrowRight size={16} />}>
                    Open Dashboard
                  </Button>
                </Link>
              ) : (
                <div className="premium-card rounded-2xl px-4 py-3 text-sm font-medium muted-copy">
                  Connect a wallet from the header to start a stake.
                </div>
              )}
              <Link to="/stake">
                <Button size="lg" variant="secondary">
                  Enter Stake Flow
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="premium-card flex h-full min-h-0 flex-col rounded-[32px] p-5 sm:p-6"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
        >
          <div className="eyebrow">Operational feed</div>
          <div className="mt-3 min-h-0">
            <Terminal logs={terminalLogs} className="hidden md:block" />
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-[24px] border border-black/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] muted-copy">Workflow</div>
              <div className="mt-2 text-sm font-medium">Select network, confirm protocol, stake asset, track destination settlement.</div>
            </div>
            <a
              href="https://faucet.raum.network"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-between rounded-[24px] border border-black/5 px-4 py-4 text-sm font-medium transition-colors hover:border-[rgba(var(--accent),0.24)] hover:bg-[rgba(var(--accent),0.05)]"
            >
              <span>Get testnet funds</span>
              <ArrowUpRight size={16} />
            </a>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {featureCards.map((card, index) => (
          <motion.div
            key={card.title}
            className="premium-card rounded-[28px] p-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.06, duration: 0.35 }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(var(--accent),0.1)] text-[rgb(var(--accent-strong))]">
              {card.icon}
            </div>
            <h3 className="mt-5 text-lg font-semibold">{card.title}</h3>
            <p className="muted-copy mt-2 text-sm leading-6">{card.copy}</p>
          </motion.div>
        ))}
      </section>

      <motion.button
        className="premium-card fixed bottom-8 right-8 hidden items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-colors hover:border-[rgba(var(--accent),0.24)] md:flex"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35 }}
        data-tally-open="3q7V77"
        data-tally-align-left="1"
        data-tally-overlay="1"
        data-tally-emoji-text="wave"
        data-tally-auto-close="3000"
      >
        <span>Share product feedback</span>
        <ArrowUpRight size={14} />
      </motion.button>
      </div>
    </div>
  );
};

export default Home;
