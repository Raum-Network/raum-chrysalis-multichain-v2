import { useWaitForTransactionReceipt } from 'wagmi';

export default function useTransactionStatus(hash : any) {
  const { data, isLoading, isError } = useWaitForTransactionReceipt({ hash });

  // console.log(data);
  if (isLoading) return 'pending';
  if (isError) return 'failed';
  if (data && data.to === '0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904') return {status:'confirmed' , token:"LINK"};
  if(data && data.to === '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582') return {status:'confirmed' , token:"USDC"};
  return 'unknown';
}
