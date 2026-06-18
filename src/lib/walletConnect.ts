import { ethers } from 'ethers';
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useReadContract,
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

type CrossmarkSdk = {
  methods?: {
    signInAndWait?: () => Promise<unknown>;
    signAndSubmitAndWait?: (payload: unknown) => Promise<unknown>;
  };
  signInAndWait?: () => Promise<unknown>;
  signAndSubmitAndWait?: (payload: unknown) => Promise<unknown>;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<string>;
};

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
  signTransaction?: <T>(transaction: T) => Promise<T>;
  signAndSendTransaction?: <T>(transaction: T) => Promise<{ signature: string }>;
};

declare global {
  interface Window {
    crossmark?: CrossmarkSdk;
    xrpl?: { crossmark?: CrossmarkSdk };
    ethereum?: Eip1193Provider;
    solana?: SolanaProvider;
  }
}

let globalNetworkOverride: Networks | null = null;
let globalCrossmarkAddress: string | null = null;
let globalSolanaAddress: string | null = null;

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

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://arc-testnet.g.alchemy.com/v2/rhTXLao3kvghbdRHQrcvM'] },
    public: { http: ['https://arc-testnet.g.alchemy.com/v2/rhTXLao3kvghbdRHQrcvM'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

// Config with all supported chains
export const config = createConfig(
  getDefaultConfig({
    chains: [arbitrumSepolia, baseSepolia, liskSepolia, plumeTestnet, arcTestnet],
    transports: {
      [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
      [baseSepolia.id]: http('https://sepolia.base.org'),
      [liskSepolia.id]: http('https://lisk-sepolia.drpc.org/'),
      [plumeTestnet.id]: http('https://testnet-rpc.plume.org'),
      [arcTestnet.id]: http('https://arc-testnet.g.alchemy.com/v2/rhTXLao3kvghbdRHQrcvM'),
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
  const [solanaAddress, setSolanaAddress] = useState<string | null>(globalSolanaAddress);
  const [xrpBalance, setXrpBalance] = useState<number>(0);
  const [solanaBalance, setSolanaBalance] = useState<number>(0);

  useEffect(() => {
    const handleOverride = (event: Event) => {
      setNetworkOverride((event as CustomEvent<Networks | null>).detail);
    };
    const handleAddress = (event: Event) => {
      setCrossmarkAddress((event as CustomEvent<string | null>).detail);
    };
    const handleSolanaAddress = (event: Event) => {
      setSolanaAddress((event as CustomEvent<string | null>).detail);
    };
    window.addEventListener('networkOverride', handleOverride);
    window.addEventListener('crossmarkAddress', handleAddress);
    window.addEventListener('solanaAddress', handleSolanaAddress);
    return () => {
      window.removeEventListener('networkOverride', handleOverride);
      window.removeEventListener('crossmarkAddress', handleAddress);
      window.removeEventListener('solanaAddress', handleSolanaAddress);
    };
  }, []);

  // Fetch XRP balance when connected to Ripple Testnet
  useEffect(() => {
    if (networkOverride !== 'ripple-testnet' || !crossmarkAddress) {
      setXrpBalance(0);
      return;
    }

    let active = true;
    const fetchXrpBalance = async () => {
      try {
        const { Client } = await import('xrpl');
        const client = new Client(
          SUPPORTED_NETWORKS['ripple-testnet'].wssUrl || 'wss://s.altnet.rippletest.net:51233',
          { connectionTimeout: 20000 }
        );
        await client.connect();
        const res = await client.request({
          command: 'account_info',
          account: crossmarkAddress,
          ledger_index: 'validated'
        });
        await client.disconnect();
        if (active) {
          setXrpBalance(Number(res.result.account_data.Balance) / 1_000_000);
        }
      } catch (e) {
        console.error('Error fetching XRP balance:', e);
      }
    };

    fetchXrpBalance();
    const interval = setInterval(fetchXrpBalance, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [networkOverride, crossmarkAddress]);

  useEffect(() => {
    if (networkOverride !== 'solana-devnet' || !solanaAddress) {
      setSolanaBalance(0);
      return;
    }

    let active = true;
    const fetchSolanaBalance = async () => {
      try {
        const response = await fetch(SUPPORTED_NETWORKS['solana-devnet'].publicRpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [solanaAddress]
          })
        });
        const data = await response.json();
        if (active) {
          setSolanaBalance(Number(data?.result?.value || 0) / 1_000_000_000);
        }
      } catch (e) {
        console.error('Error fetching SOL balance:', e);
      }
    };

    fetchSolanaBalance();
    const interval = setInterval(fetchSolanaBalance, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [networkOverride, solanaAddress]);

  const setOverride = (net: Networks | null, addr: string | null = null) => {
    globalNetworkOverride = net;
    globalCrossmarkAddress = net === 'ripple-testnet' ? addr : null;
    globalSolanaAddress = net === 'solana-devnet' ? addr : null;
    window.dispatchEvent(new CustomEvent('networkOverride', { detail: net }));
    window.dispatchEvent(new CustomEvent('crossmarkAddress', { detail: globalCrossmarkAddress }));
    window.dispatchEvent(new CustomEvent('solanaAddress', { detail: globalSolanaAddress }));
  };

  const address = networkOverride === 'ripple-testnet'
    ? crossmarkAddress
    : networkOverride === 'solana-devnet'
      ? solanaAddress
      : wagmiAddress;
  const isConnected = networkOverride === 'ripple-testnet'
    ? !!crossmarkAddress
    : networkOverride === 'solana-devnet'
      ? !!solanaAddress
      : wagmiIsConnected;

  // Add effect to monitor network changes
  useEffect(() => {
    const checkAndSwitchNetwork = async () => {
      if (isConnected && !networkOverride) {
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
      (entry) => entry[1].chainId === chainId
    );
    return {
      config: network ? network[1] : SUPPORTED_NETWORKS['arbitrum-sepolia'],
      key: network ? network[0] : 'arbitrum-sepolia'
    };
  };

  const networkConfig = getCurrentNetworkConfig().config;
  const USDC_CONTRACT_ADDRESS = networkConfig.contracts.usdc;
  const FEES_CONTRACT_ADDRESS = networkConfig.contracts.fees;

  // Always call useBalance unconditionally (React hook rule)
  const nativeBalance = useBalance({ address: (networkOverride ? undefined : address) as `0x${string}` | undefined });

  const balance = () => {
    if (networkOverride === 'ripple-testnet') {
      return xrpBalance.toFixed(4);
    }
    if (networkOverride === 'solana-devnet') {
      return solanaBalance.toFixed(4);
    }
    return ethers.formatEther(nativeBalance.data?.value || 0);
  }

  const nativeCurrencySymbol = networkOverride === 'ripple-testnet'
    ? 'XRP'
    : networkOverride === 'solana-devnet'
      ? 'SOL'
      : 'ETH';

  const canUseEvmReads = Boolean(address?.startsWith('0x')) && !networkOverride;

  // Get USDC balance with proper configuration
  const { data: usdcbalance } = useReadContract({
    address: USDC_CONTRACT_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: canUseEvmReads,
    }
  });

  const { data: feesBalance } = useReadContract({
    address: FEES_CONTRACT_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: canUseEvmReads,
    }
  });

  // Get USDC decimals
  const { data: decimals } = useReadContract({
    address: USDC_CONTRACT_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
    query: {
      enabled: canUseEvmReads,
    }
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

    if (networkOverride === 'solana-devnet') {
      try {
        const provider = window.solana;
        if (!provider) {
          alert('Solana wallet not found. Please install Phantom or another injected Solana wallet.');
          return;
        }

        const result = await provider.connect();
        const addr = result.publicKey.toString();
        setOverride('solana-devnet', addr);

        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', {
          detail: { balance: solanaBalance.toFixed(4), feesBalance: 0 }
        }));

        return {
          address: addr,
          isConnected: true,
          chainId: SUPPORTED_NETWORKS['solana-devnet'].chainId,
          balance: solanaBalance.toFixed(4),
          feesBalance: 0
        };
      } catch (error) {
        console.error('Solana wallet connection failed:', error);
        throw error;
      }
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
      } else if (networkOverride === 'solana-devnet') {
        await window.solana?.disconnect?.();
        setOverride('solana-devnet', null);
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

    if (network === 'solana-devnet') {
      setOverride('solana-devnet', null);
      console.log('Switched to Solana Devnet (pending connection)');
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
    chainId: networkOverride ? SUPPORTED_NETWORKS[networkOverride].chainId : chainId,
    network: getCurrentNetworkConfig().key,
    networkConfig: getCurrentNetworkConfig().config,
    balance: balance(),
    nativeCurrencySymbol,
    feesBalance,
    connect: handleConnect,
    disconnect: handleDisconnect,
    switchNetwork: handleSwitchNetwork,
    getFormattedBalance
  };
}
