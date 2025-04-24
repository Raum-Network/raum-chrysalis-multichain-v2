import { createContext, useContext, useState, ReactNode } from 'react';

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  balance: number;
  connectWallet: () => void;
  disconnectWallet: () => void;
}

const defaultWalletContext: WalletContextType = {
  isConnected: false,
  address: null,
  balance: 0,
  connectWallet: () => {},
  disconnectWallet: () => {},
};

const WalletContext = createContext<WalletContextType>(defaultWalletContext);

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);

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

  return (
    <WalletContext.Provider value={{
      isConnected,
      address,
      balance,
      connectWallet,
      disconnectWallet
    }}>
      {children}
    </WalletContext.Provider>
  );
};