import { ethers } from 'ethers';
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useReadContract,
  useContractWrite,
  useChainId,
  useSwitchChain
} from 'wagmi';
import { createConfig, http } from 'wagmi';
import { arbitrumSepolia, baseSepolia, liskSepolia } from 'wagmi/chains';
import { defineChain } from 'viem';
import { getDefaultConfig } from 'connectkit';
import { useEffect, useState } from 'react';
import { erc20Abi } from 'viem';
import { SUPPORTED_NETWORKS, Networks } from '../config/contract';

declare global {
  interface Window {
    crossmark?: any;
    xrpl?: any;
    ethereum?: any;
  }
}

let globalNetworkOverride: Networks | null = null;
let globalCrossmarkAddress: string | null = null;

// Custom Plume Testnet chain definition
const plumeTestnet = defineChain({
  id: 98867,
  name: 'Plume Testnet',
  network: 'plume-testnet',
  nativeCurrency: { name: 'Plume', symbol: 'PLUME', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.plume.org'] },
    public: { http: ['https://testnet-rpc.plume.org'] },
  },
  blockExplorers: {
    default: { name: 'Plume Explorer', url: 'https://testnet-explorer.plume.org' },
  },
  testnet: true,
});

// Config with all supported chains
export const config = createConfig(
  getDefaultConfig({
    chains: [arbitrumSepolia, baseSepolia, liskSepolia, plumeTestnet],
    transports: {
      [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
      [baseSepolia.id]: http('https://sepolia.base.org'),
      [liskSepolia.id]: http('https://lisk-sepolia.drpc.org/'),
      [plumeTestnet.id]: http('https://testnet-rpc.plume.org'),
    },
    walletConnectProjectId: "ffd25e3cc20b883d266134ce525caf88",
    appName: "Chrysalis - SteadyStake",
    appUrl: "https://chrysalis.raum.network",
    appIcon: "https://raw.githubusercontent.com/Zypheraum/rnlabs-frontend/refs/heads/main/public/RN-logo-white.svg",
    enableFamily: false,
  })
);

export function useWallet() {
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [networkOverride, setNetworkOverride] = useState<Networks | null>(globalNetworkOverride);
  const [crossmarkAddress, setCrossmarkAddress] = useState<string | null>(globalCrossmarkAddress);

  useEffect(() => {
    const handleOverride = (e: any) => setNetworkOverride(e.detail);
    const handleAddress = (e: any) => setCrossmarkAddress(e.detail);
    window.addEventListener('networkOverride', handleOverride);
    window.addEventListener('crossmarkAddress', handleAddress);
    return () => {
      window.removeEventListener('networkOverride', handleOverride);
      window.removeEventListener('crossmarkAddress', handleAddress);
    };
  }, []);

  const setOverride = (net: Networks | null, addr: string | null = null) => {
    globalNetworkOverride = net;
    globalCrossmarkAddress = addr;
    window.dispatchEvent(new CustomEvent('networkOverride', { detail: net }));
    window.dispatchEvent(new CustomEvent('crossmarkAddress', { detail: addr }));
  };

  const address = networkOverride === 'ripple-testnet' ? crossmarkAddress : wagmiAddress;
  const isConnected = networkOverride === 'ripple-testnet' ? !!crossmarkAddress : wagmiIsConnected;

  // Add effect to monitor network changes
  useEffect(() => {
    const checkAndSwitchNetwork = async () => {
      if (isConnected) {
        const provider = window.ethereum;
        if (provider) {
          const currentChainId = await provider.request({ method: 'eth_chainId' });
          const isSupportedNetwork = Object.values(SUPPORTED_NETWORKS).some(
            network => network.chainId === parseInt(currentChainId, 16)
          );

          if (!isSupportedNetwork) {
            try {
              await switchChain({ chainId: SUPPORTED_NETWORKS['arbitrum-sepolia'].chainId });
            } catch (error) {
              console.error('Failed to switch network:', error);
            }
          }
        }
      }
    };

    checkAndSwitchNetwork();
  }, [isConnected, switchChain]);

  // Get contract addresses for current network
  const getCurrentNetworkConfig = () => {
    if (networkOverride) {
      return { config: SUPPORTED_NETWORKS[networkOverride], key: networkOverride };
    }
    const network = Object.entries(SUPPORTED_NETWORKS).find(
      ([_, config]) => config.chainId === chainId
    );
    return {
      config: network ? network[1] : SUPPORTED_NETWORKS['arbitrum-sepolia'],
      key: network ? network[0] : 'arbitrum-sepolia'
    };
  };

  const networkConfig = getCurrentNetworkConfig().config;
  const USDC_CONTRACT_ADDRESS = networkConfig.contracts.usdc;
  const FEES_CONTRACT_ADDRESS = networkConfig.contracts.fees;

  const balance = () => {
    const bal = useBalance({
      address
    });
    return ethers.formatEther(bal.data?.value || 0);
  }

  // Get USDC balance with proper configuration
  const { data: usdcbalance } = useReadContract({
    address: USDC_CONTRACT_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: feesBalance } = useReadContract({
    address: FEES_CONTRACT_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Get USDC decimals
  const { data: decimals } = useReadContract({
    address: USDC_CONTRACT_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  const getFormattedBalance = () => {
    if (!usdcbalance || !decimals) return '0';
    return ethers.formatUnits(BigInt(usdcbalance?.toString() || '0'), BigInt(decimals?.toString() || '0'));
  };

  const handleConnect = async () => {
    if (networkOverride === 'ripple-testnet') {
      try {
        const crossmarkSdk = window.xrpl?.crossmark || window.crossmark;
        if (crossmarkSdk) {
          let result;
          if (crossmarkSdk.methods && typeof crossmarkSdk.methods.signInAndWait === 'function') {
            result = await crossmarkSdk.methods.signInAndWait();
          } else if (typeof crossmarkSdk.signInAndWait === 'function') {
            result = await crossmarkSdk.signInAndWait();
          } else {
            throw new Error("signInAndWait not found on crossmark SDK");
          }
          console.log('Crossmark connected:', result);
          const addr = result?.response?.data?.address || result?.address;
          setOverride('ripple-testnet', addr);

          window.dispatchEvent(new CustomEvent('walletBalanceUpdated', {
            detail: { balance: '0', feesBalance: 0 }
          }));

          return {
            address: addr,
            isConnected: true,
            chainId: null,
            balance: '0',
            feesBalance: 0
          };
        } else {
          alert("Crossmark extension not found. Please install it.");
        }
      } catch (error) {
        console.error('Crossmark connection failed:', error);
        throw error;
      }
      return;
    }

    try {
      // Get the current chain ID from the wallet before connecting
      const provider = window.ethereum;
      if (provider) {
        const currentChainId = await provider.request({ method: 'eth_chainId' });
        const isSupportedNetwork = Object.values(SUPPORTED_NETWORKS).some(
          network => network.chainId === parseInt(currentChainId, 16)
        );

        console.log('Current chain ID:', parseInt(currentChainId, 16), 'Is supported:', isSupportedNetwork);

        if (!isSupportedNetwork) {
          try {
            await switchChain({ chainId: SUPPORTED_NETWORKS['arbitrum-sepolia'].chainId });
          } catch (error) {
            console.error('Failed to switch network:', error);
          }
        }
      }

      await connect({ connector: config.connectors[0] });
      const formattedBalance = balance();
      const feesFormattedBalance = (feesBalance!) / BigInt(10 ** 18);

      window.dispatchEvent(new CustomEvent('walletBalanceUpdated', {
        detail: { balance: formattedBalance, feesBalance: feesFormattedBalance }
      }));

      return {
        address,
        isConnected: true,
        chainId: chainId || null,
        balance: formattedBalance,
        feesBalance: feesFormattedBalance
      };
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };


  const handleDisconnect = async () => {
    try {
      if (networkOverride === 'ripple-testnet') {
        setOverride('ripple-testnet', null);
      }
      await disconnect();
      return {
        address: null,
        isConnected: false,
        chainId: null,
        balance: null,
        feesBalance: null
      };
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      throw error;
    }
  };

  const handleSwitchNetwork = async (network: Networks) => {
    if (network === 'ripple-testnet') {
      setOverride('ripple-testnet', null);
      console.log('Switched to Ripple Testnet (pending connection)');
      return;
    }

    const targetChainId = SUPPORTED_NETWORKS[network].chainId;
    try {
      setOverride(null);
      await switchChain({ chainId: targetChainId });
      console.log(`Switched to ${network} with chain ID ${targetChainId}`);
    } catch (error) {
      console.error('Failed to switch network:', error);
      throw error;
    }
  };

  return {
    address,
    isConnected,
    chainId: networkOverride === 'ripple-testnet' ? 0 : chainId,
    network: getCurrentNetworkConfig().key,
    networkConfig: getCurrentNetworkConfig().config,
    balance: balance(),
    feesBalance,
    connect: handleConnect,
    disconnect: handleDisconnect,
    switchNetwork: handleSwitchNetwork,
    getFormattedBalance
  };
}