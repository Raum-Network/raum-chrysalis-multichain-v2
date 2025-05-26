import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Stake from './pages/Stake';
import Rewards from './pages/Rewards';
import Transactions from './pages/Transaction';
import { ThemeProvider } from './context/ThemeContext';
import { WagmiConfig, WagmiProvider } from 'wagmi'
import { config } from '../src/lib/walletConnect'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConnectKitProvider } from 'connectkit';
import { Helmet, HelmetProvider } from 'react-helmet-async';

const queryClient = new QueryClient()

function App() {
  return (
    <HelmetProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider>
            <ThemeProvider>
              <WalletProvider>
                <Helmet>
                  <script 
                    defer 
                    src="https://widget.mava.app" 
                    widget-version="v2" 
                    id="MavaWebChat" 
                    enable-sdk="false" 
                    data-token="2e68732517079e0fd3f20c330e4ab62bf3f2072ec8614153384c28a58ef76b8f"
                  />
                </Helmet>
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Layout />}>
                      <Route index element={<Home />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="stake" element={<Stake />} />
                      <Route path="rewards" element={<Rewards />} />
                      <Route path="transactions" element={<Transactions />} />
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