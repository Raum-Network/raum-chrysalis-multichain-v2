import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS } from '../config/contract';
import stakeCCTPABI from '../lib/abi/ChrysalisSenderCCTP.json';

export interface CCTPTransaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  messageBytes?: string;
  attestation?: string;
  blockTimestamp?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
}

export const fetchCCTPTransactions = async (userAddress: string): Promise<CCTPTransaction[]> => {
  try {
    const network = SUPPORTED_NETWORKS['arbitrum-sepolia'];
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);

    const contract = new ethers.Contract(
      network.contracts.cctp!,
      stakeCCTPABI,
      provider
    );

    // Use DepositForBurnWithCaller instead of DepositForBurn
    const allEvents = await contract.queryFilter(contract.filters.DepositForBurn(userAddress), 0, 'latest');

    
    // Filter by sender address manually
    const userEvents = allEvents.filter(e =>
      // console.log(e.args, userAddress),
      (e as ethers.EventLog).args[0].toLowerCase() === userAddress.toLowerCase()
    );

    const transactions: CCTPTransaction[] = await Promise.all(
      userEvents.map(async (event) => {
        const block = await event.getBlock();
        const tx = await event.getTransaction();

        return {
          hash: tx.hash,
          from: tx.from,
          to: network.contracts.cctp!,
          amount: ((event as ethers.EventLog).args[1]).toString() || '0',
          timestamp: block.timestamp * 1000,
          // messageBytes: event.args?.messageBytes || undefined,
          status: 'SUCCESS'
        };
      })
    );

    // Sort by timestamp descending (newest first)
    return transactions.sort((a, b) => b.timestamp - a.timestamp);

  } catch (error) {
    console.error('Error fetching CCTP transactions:', error);
    throw error;
  }
};
