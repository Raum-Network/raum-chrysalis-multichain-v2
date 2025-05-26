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
      <div className="hidden sm:flex flex-col w-16 border-r border-amber-700/50">
        <nav className="flex-1 px-2 py-4">
          {navItems.map((item) => (
            <div key={item.path} className="relative group">
              {item.external ? (
                <a
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center p-3 mb-1 rounded-md transition-all duration-200 hover:scale-105 ${
                    theme === 'night'
                      ? 'text-amber-400 hover:bg-amber-700/50'
                      : 'text-brown-900 hover:bg-amber-600/50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </a>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-center p-3 mb-1 rounded-md transition-all duration-200 hover:scale-105 ${
                      isActive
                        ? theme === 'night'
                          ? 'bg-amber-700 text-white'
                          : 'bg-amber-600 text-black'
                        : theme === 'night'
                        ? 'text-amber-400 hover:bg-amber-700/50'
                        : 'text-brown-900 hover:bg-amber-600/50'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                </NavLink>
              )}
              <div className={`absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 text-xs rounded border border-amber-700/50 ${
                theme === 'night' 
                  ? 'bg-gray-900 text-amber-400' 
                  : 'bg-beige-800 text-brown-900'
              } opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 shadow-lg`}>
                {item.label}
              </div>
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
                  ? 'text-amber-400/70 hover:text-amber-400'
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
                      ? 'text-amber-400'
                      : 'text-brown-900'
                    : theme === 'night'
                    ? 'text-amber-400/70 hover:text-amber-400'
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
