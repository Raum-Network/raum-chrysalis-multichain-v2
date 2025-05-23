import { useState, useEffect } from 'react';
import { useStaking } from '../hooks/useStaking';
import { useWallet } from '../lib/walletConnect';
import Button from './Button';
import AmountInput from './AmountInput';
import {Progress} from './Progress';
import { useReadContract, useWriteContract } from 'wagmi';
import { erc20Abi } from 'viem';
import TransactionReceipt from '../hooks/useTranasctionReceipt';

const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const LINK_ADDRESS = "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E";

interface StakeFormProps {
  onSuccess?: () => void;
}

export function StakeForm({ onSuccess }: StakeFormProps) {
  const { address, balance, feesBalance } = useWallet();
  const { stake, stakeStatus, isStaking, setIsStaking, bridgeProtocol, setBridgeProtocol } = useStaking();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [usdcApproved, setUsdcApproved] = useState(false);
  const [linkApproved, setLinkApproved] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [txHash, setTxHash] = useState<string>();
  const [insufficientBalanceMessage, setInsufficientBalanceMessage] = useState<string | null>(null);

  const transactionStatus = TransactionReceipt(txHash);
  const { writeContractAsync } = useWriteContract();

  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address! as `0x${string}` , "0x01851B172B1B0A5709DEEC827A88732Dba00C467"],
  });

  const { data: linkAllowance, refetch: refetchLinkAllowance } = useReadContract({
    address: LINK_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address! as `0x${string}`, "0x01851B172B1B0A5709DEEC827A88732Dba00C467"],
  });

  useEffect(() => {
    if (address) {
      checkAllowances();
    }
  }, [address, amount, usdcApproved, linkApproved]);

  useEffect(() => {
    const checkBalances = () => {
      const usdcBalance = Number(balance);

      if (bridgeProtocol === 'CCIP') {
        if (Number(feesBalance) / 10 ** 18 < 1) {
          setInsufficientBalanceMessage("Insufficient LINK Balance");
        } else if (usdcBalance < Number(amount)) {
          setInsufficientBalanceMessage("Insufficient USDC Balance");
        } else {
          setInsufficientBalanceMessage(null);
        }
      } else {
        if (usdcBalance < Number(amount)) {
          setInsufficientBalanceMessage("Insufficient USDC Balance");
        } else {
          setInsufficientBalanceMessage(null);
        }
      }
    };

    checkBalances();
  }, [amount, usdcAllowance, feesBalance, balance, bridgeProtocol]);

  const checkAllowances = async () => {
    setCheckingApproval(true);
    try {
      if (bridgeProtocol === 'CCIP') {
        await Promise.all([refetchUsdcAllowance(), refetchLinkAllowance()]);
        const stakeAmountInWei = Number(amount) * 10 ** 6;
        
        setUsdcApproved(Number(usdcAllowance) >= stakeAmountInWei);
        setLinkApproved(Number(linkAllowance) >= 10 * 10 ** 18);
      } else {
        await refetchUsdcAllowance();
        const stakeAmountInWei = Number(amount) * 10 ** 6;
        
        setUsdcApproved(Number(usdcAllowance) >= stakeAmountInWei);
        setLinkApproved(true);
      }
    } catch (error) {
      console.error("Error checking allowances:", error);
    }
    setCheckingApproval(false);
  };

  const approveToken = async (tokenAddress: string, setApproved: (value: boolean) => void) => {
    try {
      setIsApproving(true);
      let hash;

      if (tokenAddress === USDC_ADDRESS) {
        hash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: ["0x01851B172B1B0A5709DEEC827A88732Dba00C467", BigInt(Number(amount) * 10 ** 6)],
        });
      } else {
        hash = await writeContractAsync({
          address: LINK_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: ["0x01851B172B1B0A5709DEEC827A88732Dba00C467", BigInt(10 * 10 ** 18)],
        });
      }
      setTxHash(hash);
    } catch (error) {
      setApproved(false);
      setIsApproving(false);
      setTxHash(undefined);
    }
  };

  const handleStake = async () => {
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!usdcApproved) {
      return approveToken(USDC_ADDRESS, setUsdcApproved);
    }
    if (!linkApproved && bridgeProtocol === 'CCIP') {
      return approveToken(LINK_ADDRESS, setLinkApproved);
    }

    try {
      await stake(Number(amount));
      if (onSuccess) onSuccess();
    } catch (error) {
      setError('Failed to stake. Please try again.');
      setIsStaking(false);
    }
  };

  const handleMaxClick = () => {
    if (balance) {
      setAmount(balance.toString());
      setError(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <AmountInput
          value={Number(amount)}
          onChange={(value) => {
            setAmount(value.toString());
            setError(null);
          }}
          min={0}
          max={Number(balance)}
          step={0.1}
          label="Amount"
          suffix="USDC"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <div className="flex items-center space-x-4 mt-2">
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="ccip"
            name="bridge-protocol"
            value="CCIP"
            checked={bridgeProtocol === "CCIP"}
            onChange={(e) => setBridgeProtocol(e.target.value as "CCIP" | "CCTP")}
            className="w-4 h-4"
          />
          <label htmlFor="ccip" className="cursor-pointer">CCIP</label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="cctp"
            name="bridge-protocol"
            value="CCTP"
            checked={bridgeProtocol === "CCTP"}
            onChange={(e) => setBridgeProtocol(e.target.value as "CCIP" | "CCTP")}
            className="w-4 h-4"
          />
          <label htmlFor="cctp" className="cursor-pointer">CCTP</label>
        </div>
      </div>

      <Button 
        onClick={handleStake}
        disabled={!address || isStaking || !amount || checkingApproval || insufficientBalanceMessage !== null}
        fullWidth
      >
        {isStaking ? 'Staking...' : 
         insufficientBalanceMessage ? insufficientBalanceMessage :
         !usdcApproved ? 'Approve USDC' :
         !linkApproved && bridgeProtocol === 'CCIP' ? 'Approve LINK' :
         'Stake'}
      </Button>

      {stakeStatus && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Status: {stakeStatus.status}</span>
            <span>Time: {stakeStatus.timeElapsed}</span>
          </div>
          <Progress 
            value={
              stakeStatus.status === 'SUCCESS' ? 100 :
              stakeStatus.status === 'FAILURE' ? 100 :
              stakeStatus.isBlessed ? 75 :
              stakeStatus.isCommitted ? 50 :
              stakeStatus.status === 'IN_PROGRESS' ? 25 : 0
            }
          />
          {stakeStatus.sourceTxHash && (
            <div className="text-sm break-all">
              Source Tx: {stakeStatus.sourceTxHash}
            </div>
          )}
          {stakeStatus.destinationTxHash && (
            <div className="text-sm break-all">
              Destination Tx: {stakeStatus.destinationTxHash}
            </div>
          )}
        </div>
      )}
    </div>
  );
}