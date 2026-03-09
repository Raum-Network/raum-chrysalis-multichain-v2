import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../lib/walletConnect';
import NetworkSwitcher from './NetworkSwitcher';
import { Networks } from '../config/contract';

const Layout = () => {
  const { theme } = useTheme();
  const { network, switchNetwork } = useWallet();

  return (
    <div className={`h-screen overflow-hidden app-backdrop ${theme === 'night' ? 'text-slate-100' : 'text-slate-900'}`}>
      <div className="mx-auto flex h-full max-w-[1600px] flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
        <div className="flex-1 min-h-0">
          <div className={`screen-container ${theme === 'night' ? 'screen-dark' : 'screen-light'} h-full min-h-0 rounded-[32px] border border-black/5 p-3 shadow-[0_32px_90px_rgba(15,23,42,0.08)] sm:p-4`}>
            <div className="relative z-10 flex h-full flex-col">
              <Navbar />
              <div className="flex-1 min-h-0 overflow-hidden px-1 py-3 sm:px-2 sm:py-4">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sm:hidden fixed bottom-3 left-3 right-3 z-50">
        <div className="premium-surface rounded-[24px] px-3 py-3 shadow-[0_22px_50px_rgba(15,23,42,0.16)]">
          <div className="flex justify-center">
            <NetworkSwitcher
              currentNetwork={network as Networks}
              onNetworkChange={switchNetwork}
            />
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .screen-container { padding-bottom: 92px !important; }
        }
      `}</style>
    </div>
  );
};

export default Layout;
