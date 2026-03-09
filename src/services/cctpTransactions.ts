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
  sourceNetworkName?: string;
  destTransactionHash?: string; // Added for destination transaction hash
}

// Function to check message receipt and match nonces
async function checkMessageReceipt(
  event: ethers.EventLog,
  sourceProvider: ethers.Provider,
  destProvider: ethers.Provider,
  destLogs: ethers.Log[]
): Promise<string | null> {
  try {
    // Get the source transaction receipt
    const sourceReceipt = await sourceProvider.getTransactionReceipt(event.transactionHash);
    if (!sourceReceipt) return null;

    // Find the DepositForBurn event by its topic
    const DEPOSIT_FOR_BURN_TOPIC = "0x2fa9ca894982930190727e75500a97d8dc500233a5065e0f3126c48fbe0343c0";
    const sourceEvent = sourceReceipt.logs.find(log => log.topics[0] === DEPOSIT_FOR_BURN_TOPIC);

    if (!sourceEvent) return null;

   
    const nonceTopic = sourceEvent.topics[1];
    const sourceNonce = BigInt(nonceTopic).toString();

    if (!sourceNonce) return null;

    for (const log of destLogs) {
      try {
        if (log.topics[0] === "0x58200b4c34ae05ee816d710053fff3fb75af4395915d3d2a771b24aa10e3cc5d") {
        
          const destTopic = log.topics[2];
          const destNonce = BigInt(destTopic).toString();
          if (destNonce.toString() === sourceNonce.toString()) {
           
            return log.transactionHash;
          }
        }
      } catch (error) {
        console.error('Error processing transaction:', error);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking message receipt:', error);
    return null;
  }
}

export const fetchCCTPTransactions = async (userAddress: string): Promise<CCTPTransaction[]> => {
  try {
    const allTransactions: CCTPTransaction[] = [];
    const sepoliaProvider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64');

    // Get the current block number for destination chain
    const currentBlock = await sepoliaProvider.getBlockNumber();
    const blocksInAWeek = Math.floor((7 * 24 * 60 * 60) / 12);
    const fromBlock = currentBlock - blocksInAWeek;

    // Fetch all destination transactions once
    const destFilter = {
      address: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
      fromBlock: fromBlock,
      toBlock: 'latest'
    };
    const destLogs = await sepoliaProvider.getLogs(destFilter);

    // Fetch transactions from all supported networks
    for (const [, network] of Object.entries(SUPPORTED_NETWORKS)) {
      // Skip networks without CCTP contract or with zero address (base/lisk sepolia)
      if (!network.contracts.cctp || network.contracts.cctp === '0x0000000000000000000000000000000000000000') continue;

      const provider = new ethers.JsonRpcProvider(network.publicRpc

      );

      const contract = new ethers.Contract(
        network.contracts.cctp,
        stakeCCTPABI,
        provider
      );

      try {
        const allEvents = await contract.queryFilter(contract.filters.DepositForBurn(userAddress), await provider.getBlockNumber() - ((45 * 24 * 60 * 60 * 3) ), 'latest');

        // Filter by sender address manually
        const userEvents = allEvents.filter(e =>
          (e as ethers.EventLog).args[0].toLowerCase() === userAddress.toLowerCase()
        );

        const networkTransactions = await Promise.all(
          userEvents.map(async (event) => {
            const block = await event.getBlock();
            const eventLog = event as ethers.EventLog;

            // Check for message receipt on destination chain using pre-fetched logs
            const destTxHash = await checkMessageReceipt(
              eventLog,
              provider,
              sepoliaProvider,
              destLogs
            );

            return {
              hash: eventLog.transactionHash,
              from: eventLog.args[0],
              to: network.contracts.cctp!,
              amount: eventLog.args[1].toString() || '0',
              timestamp: block.timestamp * 1000,
              status: destTxHash ? 'SUCCESS' as const : 'IN_PROGRESS' as const,
              sourceNetworkName: network.name,
              destTransactionHash: destTxHash || undefined
            };
          })
        );

        allTransactions.push(...networkTransactions);
      } catch {
        // console.log(`Error fetching CCTP transactions for ${network.name}:`, error);
        // Continue with other networks even if one fails
        continue;
      }
    }

    // Sort by timestamp descending (newest first)
    return allTransactions.sort((a, b) => b.timestamp - a.timestamp);

  } catch (error) {
    console.error('Error fetching CCTP transactions:', error);
    throw error;
  }
};
