import { NavLink } from 'react-router-dom';
import { Home, BarChart3, PiggyBank, History } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import ConnectButton from './ConnectButton';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { isConnected } = useWallet();
  const { theme } = useTheme();

  const links = [
    { name: 'Home', path: '/', icon: <Home size={18} /> },
    { name: 'Dashboard', path: '/dashboard', icon: <BarChart3 size={18} /> },
    { name: 'Stake', path: '/stake', icon: <PiggyBank size={18} /> },
    { name: 'Transactions', path: '/transactions', icon: <History size={18} /> },
  ];

  return (
    <nav className="flex justify-between items-center pb-2 border-b border-amber-700/50">
      <div className="flex space-x-1 md:space-x-2">
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

      <ConnectButton />
    </nav>
  );
};

export default Navbar;