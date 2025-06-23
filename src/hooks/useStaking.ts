import { useState , useEffect } from 'react';
import { useWallet } from '../lib/walletConnect';
import { useWriteContract, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import stakedUserBalance from '../lib/sepoliaContract';
import { SUPPORTED_NETWORKS } from '../config/contract';

export function useStaking() {
  const { address, network, networkConfig , chainId } = useWallet();
  const [stakeStatus, setStakeStatus] = useState<StakeStatus | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [bridgeProtocol, setBridgeProtocol] = useState<"CCIP" | "CCTP">("CCTP");
  const [isApproving, setIsApproving] = useState(false);
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  
  const { writeContractAsync } = useWriteContract();

  const currentNetworkConfig = networkConfig;
  const USDC_ADDRESS = currentNetworkConfig.contracts.usdc;
  const LINK_ADDRESS = currentNetworkConfig.contracts.fees;
  const STAKE_CONTRACT_ADDRESS = currentNetworkConfig.contracts.ccip;
  const STAKE_CCTP_CONTRACT_ADDRESS = currentNetworkConfig.contracts.cctp;

  useEffect(() => {
    if (chainId) {
      stakeManager.updateChainId(chainId);
    }
  }, [chainId]);

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
  });

  // Read allowances
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, bridgeProtocol === 'CCIP' ? STAKE_CONTRACT_ADDRESS as `0x${string}` : STAKE_CCTP_CONTRACT_ADDRESS as `0x${string}`],
  });

  const { data: linkAllowance, refetch: refetchLinkAllowance } = useReadContract({
    address: LINK_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, STAKE_CONTRACT_ADDRESS as `0x${string}`],
  });

  const approveToken = async (amount: number) => {
    if (!address) throw new Error('Wallet not connected');
    setIsApproving(true);

    try {
      const amountInWei = BigInt(amount * 10 ** 6);
      
      // Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [bridgeProtocol === 'CCIP' ? STAKE_CONTRACT_ADDRESS as `0x${string}` : STAKE_CCTP_CONTRACT_ADDRESS as `0x${string}`, amountInWei],
      });
      await refetchUsdcAllowance();

      // For CCIP, also approve LINK
      if (bridgeProtocol === 'CCIP') {
        await writeContractAsync({
          address: LINK_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [STAKE_CONTRACT_ADDRESS as `0x${string}`, BigInt(10 * 10 ** 18)],
        });
        await refetchLinkAllowance();
      }
    } catch (error) {
      console.error('Approval failed:', error);
      throw error;
    } finally {
      setIsApproving(false);
    }
  };

  const checkAllowance = async (amount: number): Promise<boolean> => {
    if (!address) return false;
    
    const amountInWei = BigInt(amount * 10 ** 6);
    const hasUsdcAllowance = (usdcAllowance || BigInt(0)) >= amountInWei;
    
    return hasUsdcAllowance;
  };

  const stake = async (amount: number) => {
    if (!address) throw new Error('Wallet not connected');
    
    try {
      setIsStaking(true);
      setStakeAmount(amount);
      const hasAllowance = await checkAllowance(amount);
      
      if (!hasAllowance) {
        await approveToken(amount);
      }

      const stakeAmountInWei = amount * 10 ** 6;

      if (bridgeProtocol === 'CCIP') {
        // await stakeManager.stake(
        //   "16015286601757825753",
        //   "0x185915e86A5DD567FC8D381914503cb517e51317",
        //   stakeAmountInWei,
        //   "999999",
        //   writeContractAsync,
        //   () => {},
        //   setStakeStatus
        // );
      } else {
        await stakeManager.stakeCCTP(
          stakeAmountInWei,
          0,
          '0x0000000000000000000000004EFF55608e01E7C4592dDB38F77E1ae1fE49fF73',
          USDC_ADDRESS,
          '0x0000000000000000000000004EFF55608e01E7C4592dDB38F77E1ae1fE49fF73',
          address,
          writeContractAsync,
          () => {},
          setStakeStatus
        );
      }
    } catch (error) {
      console.error('Staking failed:', error);
      throw error;
    } finally {
      setIsStaking(false);
    }
  };

  const getStakedBalance = async () => {
    if (!address) return "0";
    try {
      const balance = await stakedUserBalance.getBalance(address);
      const cctpBalance = await stakedUserBalance.getBalanceCCTP(address);
      return ( Number(cctpBalance)).toString();
    } catch (error) {
      console.error("Error:", error);
      return "0";
    }
  };

  return {
    stake,
    stakeStatus,
    isStaking,
    isApproving,
    setIsStaking,
    bridgeProtocol,
    setBridgeProtocol,
    usdcBalance: usdcBalance ? Number(usdcBalance) / 10 ** 6 : 0,
    hasAllowance: bridgeProtocol === 'CCIP' 
      ? (usdcAllowance && linkAllowance 
        ? (usdcAllowance >= BigInt(10 * 10 ** 6) && linkAllowance >= BigInt(10 * 10 ** 18)) 
        : false)
      : (usdcAllowance 
        ? usdcAllowance >= BigInt(stakeAmount * 10 ** 6) 
        : false),
    checkAllowance,
    getStakedBalance,
    stakeManager
  };
}