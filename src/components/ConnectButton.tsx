import { useWallet } from '../lib/walletConnect';
import { ConnectKitButton } from 'connectkit';
import { Wallet, LogOut } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import NetworkSwitcher from './NetworkSwitcher';
import { Networks } from '../config/contract';
import ReactGA from 'react-ga4';

const ConnectButton = () => {
  const { isConnected, address, balance, network, chainId, switchNetwork, disconnect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);

  const handleDisconnect = () => {
    disconnect();
  };

  const truncateAddress = (addr: string) => {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  const handleNetworkSwitcherOpen = () => {
    setIsOpen(false); // Close the connected modal when network switcher opens
  };

  if (isConnected) {

    ReactGA.event({
      category: 'Wallet',
      action: 'Click',
      label: address ? `Connected Wallet ${address}` : 'Connect Wallet Button'
    });
    
    return (
      <div className="flex items-center space-x-2">
        <div className="hidden sm:block">
          <NetworkSwitcher
            currentNetwork={network as Networks}
            onNetworkChange={switchNetwork}
            onOpen={handleNetworkSwitcherOpen}
          />
        </div>

        <div className="relative">
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md
                      border border-green-500/40 bg-black/90
                      hover:text-black/90
                      hover: border border-black/90 hover:bg-gray-100/10 hover:border-black/90
                      transition-all duration-200 
                      text-green-500 cursor-pointer"
          >
            <div className="pulse-dot"></div>
            <span className="text-sm hidden md:inline">{truncateAddress(address || '')}</span>
          </div>

          {isOpen && (
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

              {/* Disconnect button */}
              <div className="mt-1 pt-1 border-t border-green-700/40">
                <button
                  onClick={handleDisconnect}
                  className="flex items-center space-x-2 text-red-400 hover:text-red-500 transition-colors"
                >
                  <LogOut size={16} />
                  <span>Disconnect</span>
                </button>
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
          onOpen={handleNetworkSwitcherOpen}
        />
      </div>
      <ConnectKitButton.Custom>
        {({ isConnecting, show, address, ensName }) => {
          return (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                ReactGA.event({
                  category: 'Wallet',
                  action: 'Click',
                  label: address ? `Connected Wallet ${address}` : 'Connect Wallet Button'
                });
                show?.();
              }}
              className={`
                flex items-center justify-center px-3 py-1.5 rounded-md
                border border-green-500/40 bg-black/90 hover:text-black/90
                      hover: border border-black/90 hover:bg-gray-100/10 hover:border-black/90
                transition-colors text-green-500 transition-all duration-40
                
              `}
            >
              <span className="text-sm">{isConnecting ? "Connecting..." : "Connect"}</span>
            </motion.button>
          );
        }}
      </ConnectKitButton.Custom>
    </div>
  );
};

export default ConnectButton;