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
import { polygonAmoy, arbitrumSepolia , soneiumMinato, optimismSepolia } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';
import { useEffect } from 'react';
import { erc20Abi } from 'viem';
import { SUPPORTED_NETWORKS, Networks } from '../config/contract';


// Config with all supported chains
export const config = createConfig(
  getDefaultConfig({
    chains: [arbitrumSepolia, polygonAmoy, soneiumMinato, optimismSepolia],
    transports: {
      [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
      [optimismSepolia.id]: http('https://sepolia.optimism.io'),
      [polygonAmoy.id]: http('https://polygon-amoy.drpc.org'),
      [soneiumMinato.id]: http('https://rpc.minato.soneium.org'),
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
  const { switchChain } = useSwitchChain();

  // Get contract addresses for current network
  const getCurrentNetworkConfig = () => {
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
    try {
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
    const targetChainId = SUPPORTED_NETWORKS[network].chainId;
    try {
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
    chainId,
    network: getCurrentNetworkConfig().key,
    networkConfig: getCurrentNetworkConfig().config,
    balance: balance(),
    feesBalance,
    connect: handleConnect,
    disconnect: handleDisconnect,
    switchNetwork: handleSwitchNetwork,
    usdcbalance
  };
}

// Update your component to use the hook
export function WalletComponent() {
  const { 
    isConnected, 
    chainId,
    switchNetwork
  } = useWallet();

  useEffect(() => {
    console.log(chainId);
    // Default to Arbitrum Sepolia if not connected to a supported network
    if (isConnected && !Object.values(SUPPORTED_NETWORKS).some(net => net.chainId === chainId)) {
     console.error('Unsupported network. Switching to Arbitrum Sepolia.');
    }
  }, [chainId, isConnected, switchNetwork]);

  return null;
}