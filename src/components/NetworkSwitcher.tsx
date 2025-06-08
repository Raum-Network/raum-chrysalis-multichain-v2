import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
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
          border border-green-500/40 bg-black/90
          hover:bg-green-500/20 transition-colors 
          text-green-500
        `}
      >
        <span className="text-sm">{currentNetworkConfig.name}</span>
        {/* Desktop Chevron */}
        <ChevronDown size={16} 
          className={`hidden sm:block transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
        {/* Mobile Chevron */}
        <ChevronUp size={16} 
          className={`sm:hidden transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
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
                absolute w-56 rounded-md shadow-lg z-30
                bg-gray-900
                sm:top-full sm:right-0 sm:mt-2
                bottom-full right-0 mb-2
                backdrop-blur-md
               
              `}
            >
              <div className="py-1 px-1">
                {(Object.keys(SUPPORTED_NETWORKS) as Networks[]).map((network) => (
                  <button
                    key={network}
                    onClick={() => {
                      onNetworkChange(network);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full px-4 py-2 text-sm flex items-center justify-between
                      hover:bg-green-100/10 transition-colors
                      ${currentNetwork === network ? 'bg-gray-800' : 'bg-gray-800'}
                      rounded-md mb-1
                      last:mb-0
                      text-green-500
                    `}
                  >
                    {SUPPORTED_NETWORKS[network].name}
                    {currentNetwork === network && (
                      <CheckCircle2 size={16} className="text-green-500" />
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