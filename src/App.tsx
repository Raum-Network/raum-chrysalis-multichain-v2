import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Stake from './pages/Stake';
import Rewards from './pages/Rewards';
import Transactions from './pages/Transaction';
import NotFound from './pages/NotFound';
import { ThemeProvider } from './context/ThemeContext';
import { WagmiProvider } from 'wagmi'
import { config } from '../src/lib/walletConnect'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConnectKitProvider } from 'connectkit';
import { HelmetProvider } from 'react-helmet-async';
import ReactGA from 'react-ga4';


const queryClient = new QueryClient();

function App() {

  useEffect(() => {
        ReactGA.initialize("G-8W93XDYHK5");
        // Send pageview with a custom path
        ReactGA.send({ hitType: "pageview", page: "/dashboard", title: "Dashboard" });
        ReactGA.send({ hitType: "pageview", page: "/transactions", title: "Transactions" });
        ReactGA.send({ hitType: "pageview", page: "/stake", title: "Stake" });
    }, [])
  return (
    <HelmetProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider>
            <ThemeProvider>
              <WalletProvider>
                {/* <Helmet>
                  <script 
                    defer 
                    src="https://widget.mava.app" 
                    widget-version="v2" 
                    id="MavaWebChat" 
                    enable-sdk="false" 
                    data-token="2e68732517079e0fd3f20c330e4ab62bf3f2072ec8614153384c28a58ef76b8f"
                  />
                </Helmet> */}
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <Routes>
                    <Route path="/" element={<Layout />}>
                      <Route index element={<Home />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="stake" element={<Stake />} />
                      <Route path="rewards" element={<Rewards />} />
                      <Route path="transactions" element={<Transactions />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </WalletProvider>
            </ThemeProvider>
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HelmetProvider>
  );
}

export default App;
