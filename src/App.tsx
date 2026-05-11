import { useEffect } from 'react';
import { WalletProvider } from './context/WalletContext';
import Layout from './components/Layout';
import Home from './pages/Home';
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
        ReactGA.send({ hitType: "pageview", page: "/", title: "Arc Command Terminal" });
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
                <Layout>
                  <Home />
                </Layout>
              </WalletProvider>
            </ThemeProvider>
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </HelmetProvider>
  );
}

export default App;
