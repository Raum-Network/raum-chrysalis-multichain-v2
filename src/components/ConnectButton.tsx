import { useWallet } from '../lib/walletConnect';
import { Wallet, LogOut } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import NetworkSwitcher from './NetworkSwitcher';
import { Networks } from '../config/contract';

const ConnectButton = () => {
  const { isConnected, address, balance, network, chainId, switchNetwork, connect, disconnect } = useWallet();
  const [showTooltip, setShowTooltip] = useState(false);

  const handleConnect = () => {
    connect();
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const truncateAddress = (addr: string) => {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2">
        <div className="hidden sm:block">
          <NetworkSwitcher 
            currentNetwork={network as Networks} 
            onNetworkChange={switchNetwork}
          />
        </div>
        
        <div className="relative">
          <div 
            className="flex items-center space-x-2 px-2 py-1 rounded-ßmd bg-green-900/30 border border-green-700/40"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div className="pulse-dot"></div>
            <span className="hidden md:inline text-xs text-black-400">{truncateAddress(address || '')}</span>
            <button 
              onClick={handleDisconnect}
              className="ml-1 p-1 rounded-full hover:bg-red-900/50"
            >
              <LogOut size={14} className="text-red-400" />
            </button>
          </div>
          
          {showTooltip && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`
                absolute top-full right-0 mt-2 p-2 
                bg-gray-800 border border-amber-700/40 rounded-md shadow-lg 
                text-xs whitespace-nowrap z-20
                ${window.innerWidth < 768 ? 'w-[200px]' : ''}
              `}
            >
              {/* Mobile view */}
              <div className="md:hidden">
                <div className="text-green-400 truncate">
                  Connected:{truncateAddress(address || '')}
                </div>
                <div className="text-green-400">
                  Balance:{Number(balance).toFixed(4)} ETH
                </div>
                <div className="text-green-400">
                  Network:{network}
                </div>
                <div className="text-green-400">
                  Chain ID:{chainId} ETH
                </div>
              </div>

              {/* Desktop view */}
              <div className="hidden md:block">
                <div className="text-green-400">Connected: {address}</div>
                <div className="text-green-400">Balance: {Number(balance).toFixed(4)} ETH</div>
                <div className="text-green-400">Network: {network}</div>
                <div className="text-green-400">Chain ID: {chainId}</div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Network Switcher - Only visible on desktop */}
      <div className="hidden sm:block">
        <NetworkSwitcher 
          currentNetwork={network as Networks}
          onNetworkChange={switchNetwork}
        />
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleConnect}
        className={`
          flex items-center justify-center px-4 py-2 rounded-md
          ${isConnected 
            ? 'bg-amber-700 text-beige-100' 
            : 'bg-amber-900/30 text-amber-500 hover:bg-amber-900/50'
          }
          transition-all duration-200
        `}
      >
        <Wallet size={16} className="md:mr-2" />
        <span className="hidden md:inline">Connect</span>
      </motion.button>
    </div>
  );
};

export default ConnectButton;