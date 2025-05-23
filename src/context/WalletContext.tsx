import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS, Networks } from '../config/contract';

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  balance: number;
  network: Networks;
  chainId: number | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (network: Networks) => Promise<void>;
}

const defaultWalletContext: WalletContextType = {
  isConnected: false,
  address: null,
  balance: 0,
  network: 'arbitrum-sepolia',
  chainId: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  switchNetwork: async () => {}
};

const WalletContext = createContext<WalletContextType>(defaultWalletContext);

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [network, setNetwork] = useState<Networks>('arbitrum-sepolia');
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAddress(accounts[0]);
      await updateBalance(accounts[0]);
    }
  };

  const handleChainChanged = async (chainIdHex: string) => {
    const newChainId = parseInt(chainIdHex, 16);
    setChainId(newChainId);
    
    // Find and set the corresponding network
    const networkEntry = Object.entries(SUPPORTED_NETWORKS).find(
      ([_, config]) => config.chainId === newChainId
    );
    if (networkEntry) {
      setNetwork(networkEntry[0] as Networks);
    }
  };

  const updateBalance = async (addr: string) => {
    if (provider) {
      try {
        const balance = await provider.getBalance(addr);
        setBalance(parseFloat(ethers.formatEther(balance)));
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        setAddress(accounts[0]);
        await updateBalance(accounts[0]);
        
        const chainIdHex = await window.ethereum.request({ 
          method: 'eth_chainId' 
        });
        const currentChainId = parseInt(chainIdHex, 16);
        setChainId(currentChainId);
        
        setIsConnected(true);
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAddress(null);
    setBalance(0);
    setChainId(null);
  };

  const switchNetwork = async (newNetwork: Networks) => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    const networkConfig = SUPPORTED_NETWORKS[newNetwork];
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkConfig.chainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${networkConfig.chainId.toString(16)}`,
                chainName: networkConfig.name,
                rpcUrls: [networkConfig.rpcUrl],
                blockExplorerUrls: [networkConfig.explorer],
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
        }
      }
      console.error('Error switching network:', switchError);
    }
  };

  return (
    <WalletContext.Provider value={{
      isConnected,
      address,
      balance,
      network,
      chainId,
      connectWallet,
      disconnectWallet,
      switchNetwork
    }}>
      {children}
    </WalletContext.Provider>
  );
};