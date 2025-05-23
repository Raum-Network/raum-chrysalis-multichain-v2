import { useState } from 'react';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUPPORTED_NETWORKS, Networks } from '../config/contract';
import { useTheme } from '../context/ThemeContext';

interface NetworkSwitcherProps {
  currentNetwork: Networks;
  onNetworkChange: (network: Networks) => void;
}

const NetworkSwitcher = ({ currentNetwork, onNetworkChange }: NetworkSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const currentNetworkConfig = SUPPORTED_NETWORKS[currentNetwork];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center space-x-2 px-3 py-1.5 rounded-md
          border border-amber-700/40 bg-amber-900/20
          hover:bg-amber-700/30 transition-colors
        `}
      >
        <span className="text-sm">{currentNetworkConfig.name}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`
                absolute top-full right-0 mt-2 w-56 rounded-md shadow-lg z-30
                ${theme === 'night' ? 'bg-gray-900' : 'bg-beige-100'}
                border border-amber-700/40
              `}
            >
              <div className="py-1">
                {(Object.keys(SUPPORTED_NETWORKS) as Networks[]).map((network) => (
                  <button
                    key={network}
                    onClick={() => {
                      onNetworkChange(network);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full px-4 py-2 text-sm flex items-center justify-between
                      hover:bg-amber-700/30 transition-colors
                      ${currentNetwork === network ? 'bg-amber-700/20' : ''}
                    `}
                  >
                    {SUPPORTED_NETWORKS[network].name}
                    {currentNetwork === network && (
                      <CheckCircle2 size={16} className="text-green-400" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NetworkSwitcher;