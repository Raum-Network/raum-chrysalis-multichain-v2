import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Home, Wallet, ArrowRightLeft } from 'lucide-react';

const Sidebar = () => {
  const { theme } = useTheme();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/stake', icon: Wallet, label: 'Stake' },
    { path: '/transactions', icon: ArrowRightLeft, label: 'Transactions' },
  ];

  return (
    <div className={`h-full flex ${theme === 'night' ? 'bg-gray-900' : 'bg-beige-800'}`}>
      {/* Desktop Sidebar */}
      <div className="hidden sm:flex flex-col w-16 border-r border-amber-700/50">
        <nav className="flex-1 px-2 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-center p-3 mb-1 rounded-md transition-colors ${
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
          ))}
        </nav>
      </div>

      {/* Mobile Footer Navigation */}
      <div className={`sm:hidden flex-1 flex justify-around items-center py-2 ${theme === 'night' ? 'bg-gray-900' : 'bg-beige-800'}`}>
        {navItems.map((item) => (
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
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
