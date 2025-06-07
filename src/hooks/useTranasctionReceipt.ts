import { useWaitForTransactionReceipt } from 'wagmi';
import { useWallet } from '../lib/walletConnect';

export default function useTransactionStatus(hash: any) {
  const { data, isLoading, isError } = useWaitForTransactionReceipt({ hash });
  const { networkConfig } = useWallet();

  if (isLoading) return 'pending';
  if (isError) return 'failed';
  if (data && data.to === networkConfig.contracts.fees) return {status:'confirmed' , token:"LINK"};
  if(data && data.to === networkConfig.contracts.usdc) return {status:'confirmed' , token:"USDC"};
  return 'unknown';
}
