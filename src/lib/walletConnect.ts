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
import {  arbitrumSepolia, baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';
import { useEffect } from 'react';
import { erc20Abi } from 'viem';
import { SUPPORTED_NETWORKS, Networks } from '../config/contract';


// Config with all supported chains
export const config = createConfig(
  getDefaultConfig({
    chains: [arbitrumSepolia, baseSepolia],
    transports: {
      [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
      [baseSepolia.id]: http('https://sepolia.base.org'),

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
    getFormattedBalance
  };
}