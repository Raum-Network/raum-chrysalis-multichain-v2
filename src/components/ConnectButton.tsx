import { useWallet } from '../lib/walletConnect';
import { Wallet, LogOut } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ConnectKitButton } from 'connectkit';

const ConnectButton = () => {
  const { isConnected, address, balance, connect, disconnect } = useWallet();
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
      <div className="relative">
        <div 
          className="flex items-center space-x-2 px-2 py-1 rounded-md bg-green-900/30 border border-green-700/40"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="pulse-dot"></div>
          <span className="hidden md:inline text-xs text-black-400">{truncateAddress(address || '')}</span>
          <span className="text-xs sm:inline">{balance} ETH</span>
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
            className="absolute top-full right-0 mt-2 p-2 bg-gray-800 border border-amber-700/40 rounded-md shadow-lg text-xs whitespace-nowrap z-20"
          >
            <div className="text-green-400">Connected: {address}</div>
            <div>Balance: {balance} ETH</div>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <motion.button
      onClick={handleConnect}
      className="bg-amber-700 hover:bg-amber-600 text-beige-100 rounded-md px-4 py-1 text-sm flex items-center"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Wallet size={16} className="mr-2" />
      <span>Connect</span>
    </motion.button>
  );
};

export default ConnectButton;