import { NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Home, BarChart3, DollarSign, History, Droplets, X, SunMedium, MoonStar, ArrowUpRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import ConnectButton from './ConnectButton';
import { useEffect } from 'react';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

const links = [
    { name: 'Home', path: '/', icon: <Home size={18} /> },
    { name: 'Dashboard', path: '/dashboard', icon: <BarChart3 size={18} /> },
    { name: 'Stake', path: '/stake', icon: <DollarSign size={18} /> },
    { name: 'Transactions', path: '/transactions', icon: <History size={18} /> },
    { name: 'Faucet', path: 'https://faucet.raum.network', icon: <Droplets size={18} />, external: true },
];

const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
    const { theme, toggleTheme } = useTheme();

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    const content = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        key="drawer"
                        className="fixed right-0 top-0 z-[1000] flex h-full w-[78vw] max-w-[300px] flex-col p-6"
                        style={{
                            background: theme === 'night'
                                ? 'rgba(15,23,42,0.96)'
                                : 'rgba(248,249,252,0.98)',
                            borderLeft: theme === 'night'
                                ? '1px solid rgba(255,255,255,0.07)'
                                : '1px solid rgba(0,0,0,0.06)',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 32px 80px rgba(15,23,42,0.28)',
                        }}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 340, damping: 36 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(var(--accent),0.12)] text-[rgb(var(--accent-strong))]">
                                    <Sparkles size={14} />
                                </div>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] muted-copy">Navigation</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="premium-card flex h-8 w-8 items-center justify-center rounded-2xl transition-colors hover:border-[rgba(var(--accent),0.24)]"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Nav links */}
                        <nav className="mt-8 flex flex-col gap-1">
                            {links.map((link) =>
                                link.external ? (
                                    <a
                                        key={link.name}
                                        href={link.path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={onClose}
                                        className="group flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-semibold transition-all hover:bg-[rgba(var(--accent),0.06)]"
                                    >
                                        <span className="flex items-center gap-3 muted-copy group-hover:text-[rgb(var(--accent-strong))]">
                                            {link.icon}
                                            {link.name}
                                        </span>
                                        <ArrowUpRight size={14} className="muted-copy transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                    </a>
                                ) : (
                                    <NavLink
                                        key={link.path}
                                        to={link.path}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all ${isActive
                                                ? 'premium-pill shadow-[0_8px_20px_rgba(16,122,110,0.12)]'
                                                : 'muted-copy hover:bg-[rgba(var(--accent),0.06)] hover:text-[rgb(var(--accent-strong))]'
                                            }`
                                        }
                                    >
                                        {link.icon}
                                        {link.name}
                                    </NavLink>
                                )
                            )}
                        </nav>

                        <div className="flex-1" />

                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="premium-card mb-3 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors hover:border-[rgba(var(--accent),0.24)]"
                        >
                            {theme === 'day' ? <MoonStar size={16} /> : <SunMedium size={16} />}
                            {theme === 'day' ? 'Switch to Night' : 'Switch to Day'}
                        </button>

                        {/* Connect wallet */}
                        <div className="w-full overflow-hidden">
                            <ConnectButton hideNetworkSwitcher />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(content, document.body);
};

export default MobileMenu;
