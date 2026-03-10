import { ArrowRight, ArrowUpRight, Database, DollarSign, ShieldCheck, Landmark } from 'lucide-react';
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
      message: `Network context loaded: ${networkConfig.name} (chain ${networkConfig.chainId})`,
      type: 'info',
      timestamp: new Date()
    },
    {
      message: `Supported protocols: ${networkConfig.supportedProtocols.join(', ')}`,
      type: 'info',
      timestamp: new Date()
    },
    {
      message: `Asset: ${networkConfig.assetSymbol} · Explorer: ${networkConfig.explorer}`,
      type: 'info',
      timestamp: new Date()
    },
    {
      message: 'Routing matrix available for stake and transaction flows',
      type: 'success',
      timestamp: new Date()
    },
    {
      message: 'Cross-chain message relay via CCIP and CCTP verified',
      type: 'success',
      timestamp: new Date()
    },
    {
      message: 'Destination settlement contract reachable on Ethereum Sepolia',
      type: 'info',
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
      title: 'Liquid Staking',
      copy: 'Stake your ETH while maintaining liquidity.',
      icon: <Database size={18} />
    },
    {
      title: 'High APY',
      copy: 'Earn competitive rewards on your staked assets.',
      icon: <DollarSign size={18} />
    },
    {
      title: 'Security',
      copy: 'Your assets are securely managed and protected.',
      icon: <ShieldCheck size={18} />
    },
    {
      title: 'Institutional Grade',
      copy: 'Built for both retail and institutional stakers.',
      icon: <Landmark size={18} />
    }
  ];

  return (
    <div className="route-scroll">
      <div className="page-canvas page-grid page-wide lg:grid-rows-[minmax(0,1fr)_auto]">
        <section className="min-h-0">
          <motion.div
            className="premium-surface soft-grid flex h-full min-h-0 flex-col rounded-[32px] p-5 sm:p-6"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            {/* Hero text */}
            <div className="max-w-3xl">
              <h1 className="mt-3 text-4xl font-semibold leading-[1.02] sm:text-5xl lg:text-[3.35rem]">
                A cleaner control surface for multi-protocol staking.
              </h1>
              <p className="muted-copy mt-4 max-w-2xl text-base leading-7">
                A Cross-Chain liquid staking platform with minimal complexities
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="premium-pill rounded-full px-3 py-1.5 text-xs font-semibold">Active network: {networkConfig.name}</div>
                <div className="premium-card rounded-full px-3 py-1.5 text-xs font-semibold">Protocol-specific status tracking</div>
              </div>
            </div>

            {/* Operational feed — fills the remaining card height */}
            <div className="mt-5 flex min-h-0 flex-1 flex-col">
              <div className="eyebrow mb-3">Operational feed</div>
              <Terminal
                logs={terminalLogs}
                className="flex-1 min-h-[160px]"
              />
            </div>

            {/* Action buttons — below terminal */}
            <div className="mt-4 flex flex-wrap gap-3">
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
          <span>Feedback</span>
          <ArrowUpRight size={14} />
        </motion.button>
      </div>
    </div>
  );
};

export default Home;
