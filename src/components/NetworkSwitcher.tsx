import { useState } from 'react';
import { ChevronDown, CheckCircle2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUPPORTED_NETWORKS, Networks } from '../config/contract';
import { useTheme } from '../context/ThemeContext';

interface NetworkSwitcherProps {
  currentNetwork: Networks;
  onNetworkChange: (network: Networks) => void;
  onOpen?: () => void;
}

const NetworkSwitcher = ({ currentNetwork, onNetworkChange, onOpen }: NetworkSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentNetworkConfig = SUPPORTED_NETWORKS[currentNetwork];
  const { theme } = useTheme();
  const iconColour = theme === 'night' ? 'text-white' : 'text-slate-900';

  const handleToggle = () => {
    const nextIsOpen = !isOpen;
    setIsOpen(nextIsOpen);
    if (nextIsOpen && onOpen) {
      onOpen();
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggle}
          className="inline-flex items-center gap-2 rounded-2xl border border-black/5 px-4 py-2 text-sm font-medium transition-all hover:border-[rgba(var(--accent),0.24)] hover:bg-[rgba(var(--accent),0.05)]"
        >
          <Globe size={15} className={iconColour} />
          <span className="font-semibold">{currentNetworkConfig.name !== "Ripple Testnet" ? currentNetworkConfig.name : "XRP Testnet"}</span>
          <ChevronDown size={14} className={`muted-copy transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <button
          className="premium-card rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors hover:border-[rgba(var(--accent),0.24)] md:hidden"
          data-tally-open="3q7V77"
          data-tally-align-left="1"
          data-tally-overlay="1"
          data-tally-emoji-text="wave"
          data-tally-auto-close="3000"
        >
          Feedback
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-20"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="premium-surface absolute bottom-full right-0 z-30 mb-3 w-80 rounded-[24px] p-2 sm:bottom-auto sm:top-full sm:mb-0 sm:mt-3"
            >
              {(Object.keys(SUPPORTED_NETWORKS) as Networks[]).map((network) => (
                <button
                  key={network}
                  onClick={() => {
                    onNetworkChange(network);
                    setIsOpen(false);
                  }}
                  className={`mb-1 flex w-full items-start justify-between rounded-[18px] px-4 py-3 text-left transition-colors last:mb-0 ${currentNetwork === network
                    ? 'bg-[rgba(var(--accent),0.1)]'
                    : 'hover:bg-black/5'
                    }`}
                >
                  <div>
                    <div className="text-sm font-semibold">{SUPPORTED_NETWORKS[network].name !== "Ripple Testnet" ? SUPPORTED_NETWORKS[network].name : "XRP Testnet"}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.14em] muted-copy">
                      {SUPPORTED_NETWORKS[network].supportedProtocols.join(' / ')}
                    </div>
                  </div>
                  {currentNetwork === network && <CheckCircle2 size={16} className="mt-0.5 text-[rgb(var(--accent-strong))]" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NetworkSwitcher;
