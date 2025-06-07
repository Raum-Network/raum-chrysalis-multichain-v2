import { useState } from 'react';
import { useWallet } from '../lib/walletConnect';
import { useWriteContract, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import stakedUserBalance from '../lib/sepoliaContract';

export function useStaking() {
  const { address, networkConfig, chainId } = useWallet();
  const [stakeStatus, setStakeStatus] = useState<StakeStatus | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [bridgeProtocol, setBridgeProtocol] = useState<"CCIP" | "CCTP">("CCIP");
  const [isApproving, setIsApproving] = useState(false);
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  
  const { writeContractAsync } = useWriteContract();

  // Get contract addresses from network config
  const USDC_ADDRESS = networkConfig.contracts.usdc as `0x${string}`;
  const LINK_ADDRESS = networkConfig.contracts.fees as `0x${string}`;
  const STAKE_CONTRACT_ADDRESS = networkConfig.contracts.ccip as `0x${string}`;
  const STAKE_CCTP_CONTRACT_ADDRESS = networkConfig.contracts.cctp as `0x${string}`;

  // Update StakeManager and SepoliaContract with current chainId
  stakeManager.updateChainId(chainId);
  stakedUserBalance.updateChainId(chainId);

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
  });

  // Read allowances
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, bridgeProtocol === 'CCIP' ? STAKE_CONTRACT_ADDRESS : STAKE_CCTP_CONTRACT_ADDRESS],
  });

  const { data: linkBalance } = useReadContract({
    address: LINK_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address!],
  });


  const { data: linkAllowance, refetch: refetchLinkAllowance } = useReadContract({
    address: LINK_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, STAKE_CONTRACT_ADDRESS],
  });

  const approveToken = async (amount: number) => {
    if (!address) throw new Error('Wallet not connected');
    setIsApproving(true);

    try {
      const amountInWei = BigInt(amount * 10 ** 6);
      
      // Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [bridgeProtocol === 'CCIP' ? STAKE_CONTRACT_ADDRESS : STAKE_CCTP_CONTRACT_ADDRESS, amountInWei],
      });
      await refetchUsdcAllowance();

      // For CCIP, also approve LINK
      if (bridgeProtocol === 'CCIP') {
        await writeContractAsync({
          address: LINK_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [STAKE_CONTRACT_ADDRESS, BigInt(10 * 10 ** 18)],
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
    
    if (bridgeProtocol === 'CCIP') {
      const hasLinkAllowance = (linkAllowance || BigInt(0)) >= BigInt(10 * 10 ** 18);
      return hasUsdcAllowance && hasLinkAllowance;
    }
    
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

      console.log(`0x000000000000000000000000${ networkConfig.contracts.cctpDestinationCaller}`)
      const stakeAmountInWei = amount * 10 ** 6;

      if (bridgeProtocol === 'CCIP') {
        await stakeManager.stake(
          "16015286601757825753",
          networkConfig.contracts.destination as `0x${string}`,
          stakeAmountInWei,
          "999999",
          writeContractAsync,
          () => {},
          setStakeStatus
        );
      } else {
        const cctpDestinationCaller = networkConfig.contracts.cctpDestinationCaller;
        await stakeManager.stakeCCTP(
          stakeAmountInWei,
          0,
          `0x000000000000000000000000${cctpDestinationCaller}`,
          USDC_ADDRESS,
          `0x000000000000000000000000${cctpDestinationCaller}`,
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
      return (Number(balance) + Number(cctpBalance)).toString();
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
    linkBalance: linkBalance ? Number(linkBalance) / 10 ** 18 : 0,
    hasAllowance: bridgeProtocol === 'CCIP' 
      ? (usdcAllowance && linkAllowance 
        ? (usdcAllowance >= BigInt(stakeAmount * 10 ** 6) && linkAllowance >= BigInt(10 * 10 ** 18)) 
        : false)
      : (usdcAllowance 
        ? usdcAllowance >= BigInt(stakeAmount * 10 ** 6) 
        : false),
    checkAllowance,
    getStakedBalance,
    stakeManager,
    setStakeAmount
  };
}