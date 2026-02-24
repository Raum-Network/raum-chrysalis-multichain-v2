import { ArrowRight, TreePine, Database, Shield, Wallet, DollarSign, Landmark } from 'lucide-react';
import Button from '../components/Button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useWallet } from '../lib/walletConnect';
import Terminal from '../components/Terminal';
import { ConnectKitButton } from 'connectkit';
import ReactGA from 'react-ga4';
import { useEffect } from 'react';

const Home = () => {
  const { isConnected, connect, address } = useWallet();

  const terminalLogs: { message: string; type: 'success' | 'info' | 'error' | 'warning' | 'command'; timestamp: Date; }[] = [
    {
      message: 'Chrysalis Testnet initialized',
      type: 'success',
      timestamp: new Date()
    },
    {
      message: 'Welcome to the Chrysalis liquid staking dapp',
      type: 'success',
      timestamp: new Date()
    },
    {
      message: 'Running on Testnet',
      type: 'success',
      timestamp: new Date()
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  useEffect(() => {

    if (address) {
      ReactGA.event({
        category: 'Wallet',
        action: 'Click',
        label: `Connected Wallet ${address}`
      });
    }
  }, [address])




  return (



    <div className="h-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        <motion.div
          className="flex flex-col justify-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="scanlines flex flex-col">
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-2 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              Chrysalis
            </motion.h1>
            <motion.p
              className="text-lg md:text-xl opacity-80 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              A Cross-Chain liquid staking platform <br /> with minimal complexities
            </motion.p>

            <div className="mb-8">
              <Terminal logs={terminalLogs} className="hidden md:block" />
            </div>

            {isConnected ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <Link to="/dashboard">
                  <Button
                    size="lg"
                    variant="primary"
                    icon={<ArrowRight size={18} />}
                  >
                    Go to Dashboard
                  </Button>
                </Link>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                {/* <ConnectKitButton.Custom>
                  {({ show , address }) => (
                    <Button 
                      size="lg" 
                      variant="primary"
                      onClick={() => {
                        
                        show?.();
                      }}
                    >
                      Connect Wallet To Start
                    </Button>
                  )}
                </ConnectKitButton.Custom> */}
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.div
          className="flex items-center justify-center"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
            <FeatureCard
              title="Liquid Staking"
              icon={<Database size={20} />}
              description="Stake your ETH while maintaining liquidity"
              variants={item}
            />
            <FeatureCard
              title="High APY"
              icon={<DollarSign size={20} />}
              description="Earn competitive rewards on your staked assets"
              variants={item}
            />
            <FeatureCard
              title="Security"
              icon={<Shield size={20} />}
              description="Your assets are securely managed and protected"
              variants={item}
            />
            <FeatureCard
              title="Institutional Grade"
              icon={<Landmark size={20} />}
              description="Built for both retail and institutional stakers"
              variants={item}
            />
          </div>
        </motion.div>
      </div>

      {/* Tally Button */}
      <motion.button
        className="hidden md:flex fixed bottom-10 right-10 bg-black text-green-400 px-4 py-2 rounded-lg transition-all duration-200 items-center gap-2 border border-green-500/40 hover:bg-gray-100/10 hover:text-black hover:border-black/90"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        data-tally-open="3q7V77"
        data-tally-align-left="1"
        data-tally-overlay="1"
        data-tally-emoji-text="👋"
        data-tally-emoji-animation="bounce"
        data-tally-auto-close="3000"
      >
        <span>Feedback</span>
      </motion.button>
    </div>
  );
};

const FeatureCard = ({ title, description, icon, variants }: any) => {
  return (
    <motion.div
      className="border border-amber-700/40 rounded-lg p-4 bg-amber-900/20 backdrop-blur-sm"
      variants={variants}
    >
      <div className="bg-amber-700/30 rounded-full w-10 h-10 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm opacity-70">{description}</p>
    </motion.div>
  );
};

export default Home;