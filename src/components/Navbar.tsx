import { NavLink } from 'react-router-dom';
import { Home, BarChart3, PiggyBank, History, Trophy, Menu, X } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import ConnectButton from './ConnectButton';
import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { isConnected } = useWallet();
  const { theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const links = [
    { name: 'Home', path: '/', icon: <Home size={18} /> },
    { name: 'Dashboard', path: '/dashboard', icon: <BarChart3 size={18} /> },
    { name: 'Stake', path: '/stake', icon: <PiggyBank size={18} /> },
    { name: 'Rewards', path: '/rewards', icon: <Trophy size={18} /> },
    { name: 'Transactions', path: '/transactions', icon: <History size={18} /> },
  ];

  return (
    <nav className="flex justify-between items-center pb-2 border-b border-amber-700/50">
      <div className="hidden sm:flex space-x-1 md:space-x-2">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `px-3 py-1 rounded flex items-center space-x-1 transition-colors ${
                isActive 
                  ? 'bg-amber-700 text-beige-100' 
                  : 'hover:bg-amber-700/30'
              }`
            }
          >
            {link.icon}
            <span className="hidden md:inline">{link.name}</span>
          </NavLink>
        ))}
      </div>
      
      <div className="sm:hidden">
        <button 
          onClick={toggleMobileMenu} 
          className="p-2 rounded-md hover:bg-amber-700/30"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <ConnectButton />
      
      {mobileMenuOpen && (
        <div className={`absolute top-[4.5rem] left-0 right-0 ${theme === 'night' ? 'bg-gray-900' : 'bg-beige-800'} border-y border-amber-700 sm:hidden z-20 shadow-lg`}>
          <div className="flex flex-col p-2">
            {links.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-3 my-1 rounded flex items-center space-x-2 ${
                    isActive 
                      ? 'bg-amber-700 text-beige-100' 
                      : 'hover:bg-amber-700/30'
                  }`
                }
              >
                {link.icon}
                <span>{link.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;