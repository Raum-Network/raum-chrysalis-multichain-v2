import { useWallet } from '../lib/walletConnect';
import { ConnectKitButton } from 'connectkit';
import { LogOut, Wallet2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import NetworkSwitcher from './NetworkSwitcher';
import { Networks } from '../config/contract';
import ReactGA from 'react-ga4';
import {
  useTheme
} from '../context/ThemeContext';

const ConnectButton = ({ hideNetworkSwitcher = false }: { hideNetworkSwitcher?: boolean }) => {
  const { isConnected, address, balance, nativeCurrencySymbol, network, chainId, switchNetwork, disconnect, connect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const iconColour = theme === 'night' ? 'text-white' : 'text-slate-900';

  const handleDisconnect = () => {
    ReactGA.event({
      category: 'Wallet',
      action: 'Disconnect',
      label: address ? `Disconnect ${address}` : 'Disconnect Wallet'
    });
    disconnect();
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleNetworkSwitcherOpen = () => {
    setIsOpen(false);
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        {!hideNetworkSwitcher && (
          <div className="hidden sm:block">
            <NetworkSwitcher
              currentNetwork={network as Networks}
              onNetworkChange={switchNetwork}
              onOpen={handleNetworkSwitcherOpen}
            />
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/5 px-4 py-2 text-sm font-medium transition-all hover:border-[rgba(var(--accent),0.24)] hover:bg-[rgba(var(--accent),0.05)]"
          >
            <Wallet2 size={15} className={iconColour} />
            <span className="font-semibold">{truncateAddress(address || '')}</span>
          </button>

          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="premium-surface absolute right-0 top-full z-30 mt-3 w-[280px] rounded-[24px] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] muted-copy">Connected wallet</div>
                  <div className="mt-2 break-all text-sm font-semibold">{address}</div>
                </div>
                <div className="premium-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  <ShieldCheck size={12} />
                  Active
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <div className="premium-card rounded-2xl px-3 py-3 text-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] muted-copy">Balance</div>
                  <div className="mt-1 font-semibold">{Number(balance).toFixed(4)} {nativeCurrencySymbol}</div>
                </div>
                <div className="premium-card rounded-2xl px-3 py-3 text-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] muted-copy">Network</div>
                  <div className="mt-1 font-semibold">{network}</div>
                </div>
                <div className="premium-card rounded-2xl px-3 py-3 text-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] muted-copy">Chain ID</div>
                  <div className="mt-1 font-semibold">{chainId}</div>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-red-500/20 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
              >
                <LogOut size={15} />
                <span>Disconnect</span>
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {!hideNetworkSwitcher && (
        <div className="hidden sm:block">
          <NetworkSwitcher
            currentNetwork={network as Networks}
            onNetworkChange={switchNetwork}
            onOpen={handleNetworkSwitcherOpen}
          />
        </div>
      )}
      <ConnectKitButton.Custom>
        {({ isConnecting, show, address: connectedAddress }) => (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.99 }}
            onClick={async () => {
              ReactGA.event({
                category: 'Wallet',
                action: 'Click',
                label: connectedAddress ? `Connected Wallet ${connectedAddress}` : 'Connect Wallet Button'
              });
              if (network === 'ripple-testnet') {
                await connect();
              } else {
                show?.();
              }
            }}
            className="rounded-2xl bg-[rgb(var(--ink-strong))] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(15,23,42,0.16)] transition-colors hover:bg-[rgb(var(--accent-strong))]"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </motion.button>
        )}
      </ConnectKitButton.Custom>
    </div>
  );
};

export default ConnectButton;
