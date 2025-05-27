import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Home, Wallet, ArrowRightLeft, Droplets } from 'lucide-react';

const Sidebar = () => {
  const { theme } = useTheme();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/stake', icon: Wallet, label: 'Stake' },
    { path: '/transactions', icon: ArrowRightLeft, label: 'Transactions' },
    { 
      path: 'https://faucet.raum.network', // Replace with your actual faucet URL
      icon: Droplets, 
      label: 'Faucet',
      external: true 
    }
  ];

  return (
    <div className={`h-full flex ${theme === 'night' ? 'bg-gray-900' : 'bg-beige-800'}`}>
      {/* Desktop Sidebar */}
      <div className="hidden sm:flex flex-col w-24 border-r border-amber-700/50">
        <nav className="flex-1 px-2 py-4">
          {navItems.map((item) => (
            <div key={item.path} className="relative group">
              {item.external ? (
                <a
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center p-3 mb-2 rounded-md transition-all duration-200 hover:scale-105 ${
                    theme === 'night'
                      ? 'text-green-500 hover:bg-green-500/20'
                      : 'text-brown-900 hover:bg-amber-600/50'
                  }`}
                >
                  <item.icon className="w-5 h-5 mb-1" />
                  <span className="text-xs text-center">{item.label}</span>
                </a>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center p-3 mb-2 rounded-md transition-all duration-200 hover:scale-105 ${
                      isActive
                        ? theme === 'night'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-amber-600 text-black'
                        : theme === 'night'
                        ? 'text-green-500 hover:bg-green-500/20'
                        : 'text-brown-900 hover:bg-amber-600/50'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 mb-1" />
                  <span className="text-xs text-center">{item.label}</span>
                </NavLink>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Mobile Footer Navigation */}
      <div className={`sm:hidden flex-1 flex justify-around items-center py-2 ${theme === 'night' ? 'bg-gray-900' : 'bg-beige-800'}`}>
        {navItems.map((item) => (
          item.external ? (
            <a
              key={item.path}
              href={item.path}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center px-2 py-1 rounded-md transition-colors ${
                theme === 'night'
                  ? 'text-green-500/70 hover:text-green-500'
                  : 'text-brown-900/70 hover:text-brown-900'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </a>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center px-2 py-1 rounded-md transition-colors ${
                  isActive
                    ? theme === 'night'
                      ? 'text-green-500'
                      : 'text-brown-900'
                    : theme === 'night'
                    ? 'text-green-500/70 hover:text-green-500'
                    : 'text-brown-900/70 hover:text-brown-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </NavLink>
          )
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
