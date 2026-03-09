import { NavLink } from 'react-router-dom';
import { Home, BarChart3, DollarSign, History, ArrowUpRight, Droplets, Clock3, SunMedium, MoonStar, Sparkles } from 'lucide-react';
import ConnectButton from './ConnectButton';
import { useTheme } from '../context/ThemeContext';
import { useEffect, useState } from 'react';

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const links = [
    { name: 'Home', path: '/', icon: <Home size={16} /> },
    { name: 'Dashboard', path: '/dashboard', icon: <BarChart3 size={16} /> },
    { name: 'Stake', path: '/stake', icon: <DollarSign size={16} /> },
    { name: 'Transactions', path: '/transactions', icon: <History size={16} /> },
    { name: 'Faucet', path: 'https://faucet.raum.network', icon: <Droplets size={16} />, external: true },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <nav className="premium-surface relative z-10 rounded-[24px] px-3 py-2.5 sm:px-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgba(var(--accent),0.12)] text-[rgb(var(--accent-strong))]">
              <Sparkles size={16} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold sm:text-xl">Chrysalis</h1>
              <span className="premium-pill rounded-full px-2 py-1 text-[10px] font-semibold">Testnet</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="premium-card hidden items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium muted-copy lg:flex">
              <Clock3 size={14} />
              <span className="font-mono">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="premium-card flex h-10 w-10 items-center justify-center rounded-2xl transition-colors hover:border-[rgba(var(--accent),0.24)]"
            >
              {theme === 'day' ? <MoonStar size={16} /> : <SunMedium size={16} />}
            </button>
            <ConnectButton />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-black/5 pt-2">
          {links.map((link) => (
            link.external ? (
              <a
                key={link.name}
                href={link.path}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-2xl border border-black/5 px-4 py-2 text-sm font-medium transition-all hover:border-[rgba(var(--accent),0.24)] hover:bg-[rgba(var(--accent),0.06)]"
              >
                {link.icon}
                <span>{link.name}</span>
                <ArrowUpRight size={13} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            ) : (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) => `inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'premium-pill shadow-[0_12px_26px_rgba(16,122,110,0.12)]'
                    : 'border border-black/5 hover:border-[rgba(var(--accent),0.24)] hover:bg-[rgba(var(--accent),0.05)]'
                }`}
              >
                {link.icon}
                <span>{link.name}</span>
              </NavLink>
            )
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
