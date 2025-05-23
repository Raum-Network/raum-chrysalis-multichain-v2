import { useState } from 'react';
import { useWallet } from '../lib/walletConnect';
import { useWriteContract, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import stakedUserBalance from '../lib/sepoliaContract';

const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const LINK_ADDRESS = "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E";
const STAKE_CONTRACT_ADDRESS = "0x01851B172B1B0A5709DEEC827A88732Dba00C467";
const STAKE_CCTP_CONTRACT_ADDRESS = "0xd827d623E84EB86E4b829f92B3C77936BdAEF136";

export function useStaking() {
  const { address } = useWallet();
  const [stakeStatus, setStakeStatus] = useState<StakeStatus | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [bridgeProtocol, setBridgeProtocol] = useState<"CCIP" | "CCTP">("CCIP");
  const [isApproving, setIsApproving] = useState(false);
  
  const { writeContractAsync } = useWriteContract();

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
      const hasAllowance = await checkAllowance(amount);
      
      if (!hasAllowance) {
        await approveToken(amount);
      }

      const stakeAmountInWei = amount * 10 ** 6;

      if (bridgeProtocol === 'CCIP') {
        await stakeManager.stake(
          "16015286601757825753",
          "0x185915e86A5DD567FC8D381914503cb517e51317",
          stakeAmountInWei,
          "999999",
          writeContractAsync,
          () => {},
          setStakeStatus
        );
      } else {
        await stakeManager.stakeCCTP(
          stakeAmountInWei,
          0,
          '0x0000000000000000000000000267Cf87951fB8e6BE909025cCC67f8DDE991eA7',
          USDC_ADDRESS,
          '0x0000000000000000000000000267Cf87951fB8e6BE909025cCC67f8DDE991eA7',
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
    hasAllowance: bridgeProtocol === 'CCIP' 
      ? (usdcAllowance && linkAllowance 
        ? (usdcAllowance >= BigInt(10 * 10 ** 6) && linkAllowance >= BigInt(10 * 10 ** 18)) 
        : false)
      : (usdcAllowance 
        ? usdcAllowance >= BigInt(10 * 10 ** 6) 
        : false),
    checkAllowance,
    getStakedBalance,
    stakeManager
  };
}