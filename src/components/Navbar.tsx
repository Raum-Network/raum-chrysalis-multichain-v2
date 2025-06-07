import { NavLink } from 'react-router-dom';
import { Home, BarChart3, DollarSign, History, DropletIcon } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import ConnectButton from './ConnectButton';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { isConnected } = useWallet();
  const { theme } = useTheme();

  const links = [
    { name: 'Home', path: '/', icon: <Home size={18} /> },
    { name: 'Dashboard', path: '/dashboard', icon: <BarChart3 size={18} /> },
    { name: 'Stake', path: '/stake', icon: <DollarSign size={18} /> },
    { name: 'Transactions', path: '/transactions', icon: <History size={18} /> },
    { name: 'Faucet', path: 'https://faucet.raum.network', icon: <DropletIcon size={18} />, external: true },
  ];

  return (
    <nav className="flex justify-between items-center pb-2 border-b border-amber-700/50">
      <div className="flex space-x-1 md:space-x-2">
        {links.map((link) => (
          link.external ? (
            <a
              key={link.name}
              href={link.path}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded flex items-center space-x-1 transition-all duration-200 hover:bg-amber-700/30"
            >
              {link.icon}
              <span className="hidden md:inline">{link.name}</span>
            </a>
          ) : (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded flex items-center space-x-1 transition-all duration-200 ${
                  isActive 
                    ? 'bg-amber-700 text-beige-100 border-2 border-amber-500 transform scale-105 shadow-lg' 
                    : 'hover:bg-amber-700/30'
                }`
              }
            >
              {link.icon}
              <span className="hidden md:inline">{link.name}</span>
            </NavLink>
          )
        ))}
      </div>

      <ConnectButton />
    </nav>
  );
};

export default Navbar;