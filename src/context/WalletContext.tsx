import { createContext, useContext, useState, ReactNode } from 'react';
import { Networks, SUPPORTED_NETWORKS } from '../config/contract';

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  balance: number;
  network: Networks;
  connectWallet: () => void;
  disconnectWallet: () => void;
  switchNetwork: (network: Networks) => void;
}

const defaultWalletContext: WalletContextType = {
  isConnected: false,
  address: null,
  balance: 0,
  network: 'arbitrum-sepolia',
  connectWallet: () => {},
  disconnectWallet: () => {},
  switchNetwork: () => {},
};

const WalletContext = createContext<WalletContextType>(defaultWalletContext);

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [network, setNetwork] = useState<Networks>('arbitrum-sepolia');

  const connectWallet = () => {
    // Simulate wallet connection
    const mockAddress = '0x' + Array(40).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    setAddress(mockAddress);
    setBalance(Math.floor(Math.random() * 10000) / 100);
    setIsConnected(true);
  };

  const disconnectWallet = () => {
    setAddress(null);
    setBalance(0);
    setIsConnected(false);
  };

  const switchNetwork = (newNetwork: Networks) => {
    setNetwork(newNetwork);
  };

  return (
    <WalletContext.Provider value={{
      isConnected,
      address,
      balance,
      network,
      connectWallet,
      disconnectWallet,
      switchNetwork
    }}>
      {children}
    </WalletContext.Provider>
  );
};