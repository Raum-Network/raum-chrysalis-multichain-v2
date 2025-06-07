import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useTheme } from '../context/ThemeContext';
import { Clock, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWallet } from '../lib/walletConnect';
import NetworkSwitcher from './NetworkSwitcher';
import { Networks } from '../config/contract';

const Layout = () => {
  const { theme, toggleTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { network, switchNetwork } = useWallet();
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className={`h-screen font-mono flex flex-col ${theme === 'night' ? 'bg-gray-900 text-amber-400' : 'bg-beige-800 text-brown-900'}`}>
      {/* Top Bar */}
      <div className={`h-8 flex items-center justify-between px-4 border-b border-amber-700 ${theme === 'night' ? 'bg-gray-900 text-amber-100' : 'bg-beige-800 text-brown-900'} z-10`}>
        <div className="flex items-center">
          <span className="hidden sm:inline font-bold">Chrysalis</span>
          <span className="sm:hidden font-bold">Chrysalis</span>
          <span className="mx-2">|</span>
          <span className="text-xs">Testnet</span>
        </div>
        <div className="flex items-center">
          <Clock size={14} className="mr-1" />
          <span className="text-xs font-medium">{currentTime.toLocaleTimeString()}</span>
          <button 
            onClick={toggleTheme}
            className="ml-4 p-1 rounded-md hover:bg-amber-700 transition-colors"
          >
            {theme === 'day' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Hidden on mobile */}
        {/* <div className="hidden sm:block">
          <Sidebar />
        </div> */}

        {/* Main content */}
        <div className="flex-1 overflow-hidden p-4 sm:p-6">
          <div className={`screen-container ${theme === 'night' ? 'screen-dark' : 'screen-light'} h-full rounded-md overflow-hidden border-4 border-amber-700 p-2 sm:p-4 flex flex-col`}>
            <Navbar />
            <div className="flex-1 py-4 px-2 overflow-auto">
              <Outlet />
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Network Switcher */}
      <div className="sm:hidden border-t border-amber-700/50 p-2">
        <div className="flex justify-center">
          <NetworkSwitcher 
            currentNetwork={network as Networks} 
            onNetworkChange={switchNetwork}
          />
        </div>
      </div>
    </div>
  );
};

export default Layout;
