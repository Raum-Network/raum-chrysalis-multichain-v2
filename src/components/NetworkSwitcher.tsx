import { useState } from 'react';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUPPORTED_NETWORKS, Networks } from '../config/contract';

interface NetworkSwitcherProps {
  currentNetwork: Networks;
  onNetworkChange: (network: Networks) => void;
  onOpen?: () => void;
}

const NetworkSwitcher = ({ currentNetwork, onNetworkChange, onOpen }: NetworkSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentNetworkConfig = SUPPORTED_NETWORKS[currentNetwork];
  const enabledNetworks: Networks[] = ['arc-testnet'];

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
          className="flex min-w-[170px] items-center justify-between gap-3 rounded-md border border-emerald-400/20 bg-white/[0.04] px-3 py-2 text-left transition-colors hover:bg-emerald-400/10"
        >
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Network</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{currentNetworkConfig.name}</div>
          </div>
          <ChevronDown size={16} className={`text-emerald-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
              className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-emerald-400/15 bg-black/95 p-2 shadow-[0_28px_70px_rgba(0,0,0,0.45)] backdrop-blur"
            >
              {enabledNetworks.map((network) => (
                <button
                  key={network}
                  onClick={() => {
                    onNetworkChange(network);
                    setIsOpen(false);
                  }}
                  className={`mb-1 flex w-full items-start justify-between rounded-md px-4 py-3 text-left transition-colors last:mb-0 ${
                    currentNetwork === network
                      ? 'bg-emerald-400/10'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{SUPPORTED_NETWORKS[network].name}</div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
                      {SUPPORTED_NETWORKS[network].supportedProtocols.join(' / ')}
                    </div>
                  </div>
                  {currentNetwork === network && <CheckCircle2 size={16} className="mt-0.5 text-emerald-300" />}
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
