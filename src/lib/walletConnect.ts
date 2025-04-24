"use client";
import { ethers } from 'ethers';
import { 
  useAccount, 
  useBalance, 
  useConnect, 
  useDisconnect, 
  useReadContract,
  useContractWrite,
  useChainId,
} from 'wagmi';
import { createConfig, http } from 'wagmi';
import { polygonAmoy } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';
import { getChainId } from 'viem/actions';
import { useEffect } from 'react';
import { erc20Abi } from 'viem';

const USDC_CONTRACT_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";

// Config remains the same
export const config = createConfig(
  getDefaultConfig({
    chains: [polygonAmoy],
    transports: {
      [polygonAmoy.id]: http(`https://polygon-amoy.drpc.org`),
    },
    walletConnectProjectId: "ffd25e3cc20b883d266134ce525caf88",
    appName: "Chrysalis - SteadyStake",
    appUrl: "https://steadystake.chrysalis.raum.network",
    appIcon: "https://family.co/logo.png",
    enableFamily: false,
  })
);

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  // Get USDC balance with proper configuration
  const { data: balance } = useReadContract({
    address: USDC_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: linkBalance } = useReadContract({
    address: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Get USDC decimals
  const { data: decimals } = useReadContract({
    address: USDC_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  const getFormattedBalance = () => {
    if (!balance || !decimals) return '0';
    return ethers.formatUnits(BigInt(balance?.toString() || '0'), BigInt(decimals?.toString() || '0'));
  };

  const handleConnect = async () => {
    try {
      await connect({ connector: config.connectors[0] });
      const formattedBalance = getFormattedBalance();
      const linkFormattedBalance = (linkBalance!) / BigInt(10 ** 18);
      
      window.dispatchEvent(new CustomEvent('walletBalanceUpdated', {
        detail: { balance: formattedBalance, linkBalance: linkFormattedBalance }
      }));

      return {
        address,
        isConnected: true,
        chainId: chainId || null,
        balance: formattedBalance,
        linkBalance: linkFormattedBalance
      };
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      return {
        address: null,
        isConnected: false,
        chainId: null,
        balance: null,
        linkBalance:null
      };
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      throw error;
    }
  };

  return {
    address,
    isConnected,
    chainId: chainId,
    balance: getFormattedBalance(),
    linkBalance,
    connect: handleConnect,
    disconnect: handleDisconnect,
  };
}

// Update your component to use the hook
export function WalletComponent() {
  const { 
    address, 
    isConnected, 
    chainId, 
    balance, 
    connect, 
    disconnect 
  } = useWallet();

  useEffect(() => {
    if (isConnected && chainId !== 80002) {
      window.dispatchEvent(new CustomEvent('walletNetworkSwitch', {
        detail: { targetChainId: 80002 }
      }));
    }
  }, [chainId, isConnected]);

  return null; // or your wallet UI component
}