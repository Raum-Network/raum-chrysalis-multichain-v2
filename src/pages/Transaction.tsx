import { useState, useEffect, useRef } from 'react';
import { useWallet } from '../lib/walletConnect';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import Window from '../components/Window';
import Button from '../components/Button';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, Filter, Search, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useStakingStore } from '../store/stakingStore';
import { getCCIPStatus } from '../services/api';
import { CCTPTransaction, fetchCCTPTransactions } from '../services/cctpTransactions';
import { SUPPORTED_NETWORKS } from '../config/contract';
import { ethers } from 'ethers';
import stakedUserBalance from '../lib/sepoliaContract';
import { ConnectKitButton } from 'connectkit';
import ReactGA from 'react-ga4';

const ITEMS_PER_PAGE = 5;

// First, update the MessageState mapping to match the API response
const MessageState = {
  UNTOUCHED: 0,
  IN_PROGRESS: 1,
  SUCCESS: 2,
  FAILURE: 3
} as const;

type TransactionState = typeof MessageState[keyof typeof MessageState];

const tupleType = `tuple(
  uint64 sourceChainSelector,
  address sender,
  address receiver,
  uint64 sequenceNumber,
  uint256 gasLimit,
  bool strict,
  uint64 nonce,
  address feeToken,
  uint256 feeTokenAmount,
  bytes data,
  tuple(address token, uint256 amount)[] tokenAmounts,
  bytes32 extraData,
  bytes32 messageId
)`;

const abiCoder = new ethers.AbiCoder();

interface Transaction {
  state: TransactionState;
  messageId: string;
  sourceNetworkName: string;
  destNetworkName: string;
  sourceDecimals: number;
  destDecimals: number;
  sourceTxHash?: string;
  destTransactionHash: string;
  bridgingMessageId?: string;
  protocol?: string;
  hash?: string;
  origin?: string;
  sender?: string;
  receiver?: string;
  tokenAmounts?: Array<{
    amount: string;
    token: {
      symbol: string;
      decimals: number;
      address?: string;
    }
  }>;
  blockTimestamp?: any;
  status?: string;
  sourceChainSelector?: string;
  sourceChainName?: string;
  destinationChainSelector?: string;
  destinationChainName?: string;
  sourceTimestamp?: string;
  destinationTimestamp?: string | null;
}

const Transactions = () => {
  const { isConnected, connect, address, networkConfig } = useWallet();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const { transactions, fetchTransactions } = useStakingStore();
  const [currentStatus, setCurrentStatus] = useState<StakeStatus | null>(null);
  const [currentTxState, setCurrentTxState] = useState<string>('1'); // Default to IN_PROGRESS
  const [bridgingInfo, setBridgingInfo] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [cctpTransactions, setCctpTransactions] = useState<CCTPTransaction[]>([]);
  const fetchedPagesRef = useRef<Set<number>>(new Set());

  // Helper functions
  const getStatusIcon = (state: TransactionState) => {
    switch (state) {
      case MessageState.SUCCESS:
        return <CheckCircle2 size={16} className="text-green-400" />;
      case MessageState.IN_PROGRESS:
        return <Clock size={16} className="text-amber-400" />;
      case MessageState.FAILURE:
      case MessageState.UNTOUCHED:
        return <XCircle size={16} className="text-red-400" />;
      default:
        return <Clock size={16} className="text-amber-400" />;
    }
  };

  const formatAmount = (amount: string, decimals: number) => {
    return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
  };

  useEffect(() => {

    if(address) {
    ReactGA.event({
      category: 'Wallet',
      action: 'Click',
      label: `Connected Wallet ${address}`
    });
  }
  } , [address])

  // Update the useEffect to load both types of transactions together
  useEffect(() => {
    const loadTransactions = async () => {
      if (address) {
        setIsLoading(true);
        try {
          // Load both types of transactions in parallel
          const [ccipResult, cctpResult] = await Promise.all([
            fetchTransactions(address),
            fetchCCTPTransactions(address)
          ]);
          
          setCctpTransactions(cctpResult);
        } catch (error) {
          console.error('Error fetching transactions:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadTransactions();
    
    // Polling for updates every 30 seconds
    const interval = setInterval(loadTransactions, 30000);
    return () => clearInterval(interval);
  }, [address, fetchTransactions]);

  // Add effect to listen for status updates from StakeManager
  useEffect(() => {
    const handleStatusUpdate = (status: StakeStatus) => {
      setCurrentStatus(status);
    };

    // Subscribe to status updates
    const unsubscribe = stakeManager.subscribeToStatus(handleStatusUpdate);

    return () => {
      unsubscribe();
    };
  }, []);

  // Effect to fetch CCIP status for current transaction
  useEffect(() => {
    const fetchCurrentTxStatus = async () => {
      if (currentStatus?.ccipMessageId) {
        try {
          const response = await getCCIPStatus(currentStatus.ccipMessageId);
          setCurrentTxState(response.state.toString());
        } catch (error) {
          console.error('Error fetching CCIP status:', error);
          setCurrentTxState('1'); // Default to IN_PROGRESS on error
        }
      }
    };

    if ( currentStatus?.ccipMessageId && currentStatus?.status === null) {
      fetchCurrentTxStatus();
      
      const interval = setInterval(fetchCurrentTxStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [currentStatus?.ccipMessageId, currentStatus?.status]);

  // Update the filter logic in filteredTransactions
  const filteredTransactions = [...transactions]
    .filter(tx => {
      if (filter === 'all') return true;
      switch (filter) {
        case 'completed':
          return tx.state === 2;
        case 'pending':
          return tx.state === 1
        case 'failed':
          return tx.state === 3
        default:
          return true;
      }
    })
    .filter(tx => 
      searchQuery === '' || 
      tx.messageId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.sender?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.receiver?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Update the transaction mapping for current stake
  const allTransactions = [
    ...(currentStatus?.status === 'IN_PROGRESS' && currentStatus?.sourceNetworkName === networkConfig.name ? [{
      messageId: currentStatus.ccipMessageId || 'Pending...',
      state: currentTxState === '2' ? MessageState.SUCCESS :
             currentTxState === '3' ? MessageState.FAILURE :
             currentTxState === '1' ? MessageState.IN_PROGRESS : 
             MessageState.UNTOUCHED,
      blockTimestamp: currentStatus.timestamp || Date.now(),
      origin: currentStatus.origin || address,
      receiver: currentStatus.receiver,
      sourceTxHash: currentStatus.sourceTxHash,
      destTransactionHash: currentStatus.destinationTxHash || '',
      tokenAmounts: [{
        amount: currentStatus.amount?.toString() || '0',
        token: { symbol: 'USDC', decimals: currentStatus.sourceDecimals || 6 }
      }],
      protocol: 'CCIP',
      sourceNetworkName: currentStatus.sourceNetworkName || 'Arbitrum Sepolia',
      destNetworkName: 'Sepolia',
      sourceDecimals: currentStatus.sourceDecimals || 6,
      destDecimals: 6
    }] : []),
    ...filteredTransactions
      .filter(tx => {
        // Only show transactions for the connected chain
        if (tx.sourceNetworkName !== networkConfig.name) return false;
        // Check if the source network exists in SUPPORTED_NETWORKS
        const sourceNetwork = Object.entries(SUPPORTED_NETWORKS).find(([_, network]) => {
          return network.name === tx.sourceNetworkName || 
                 network.ccipNames.sourceName === tx.sourceNetworkName ||
                 network.ccipNames.destName === tx.sourceNetworkName;
        });
        // Only return true if we found a matching network
        return sourceNetwork !== undefined;
      })
      .map(tx => {
     
        
        // Find the source network configuration
        const [sourceKey, sourceNetwork] = Object.entries(SUPPORTED_NETWORKS).find(([_, network]) => 
          network.name === tx.sourceNetworkName || 
          network.ccipNames.sourceName === tx.sourceNetworkName ||
          network.ccipNames.destName === tx.sourceNetworkName
        ) || [null, null];
        
        

        // If no source network found, skip this transaction
        if (!sourceNetwork) {
          
          return null;
        }

        const mappedTx = {
          ...tx,
          protocol: 'CCIP',
          blockTimestamp: tx.blockTimestamp,
          sourceNetworkName: sourceNetwork.name, // Use the network's display name
          destNetworkName: 'Sepolia',
          sourceDecimals: sourceNetwork.contracts.decimal || 6,
          destDecimals: 6, // Sepolia always uses 6 decimals
          destTransactionHash: tx.destTransactionHash || '',
          tokenAmounts: tx.tokenAmounts?.map(token => ({
            amount: token.amount,
            token: {
              ...token.token,
              decimals: sourceNetwork.contracts.decimal || 6
            }
          }))
        };
        
        
        return mappedTx;
      })
      .filter(Boolean), // Remove any null entries
    ...cctpTransactions
      .filter(tx => {
        // Only show CCTP transactions for the connected chain
        if (tx.sourceNetworkName !== networkConfig.name) return false;
        // Only include CCTP transactions if there's no search query or if they match the search
        if (searchQuery === '') return true;
        return tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
               tx.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
               tx.to.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .filter(tx => {
        // Find the network that matches the source network
        const sourceNetwork = Object.entries(SUPPORTED_NETWORKS).find(([_, network]) => 
          network.name === tx.sourceNetworkName || 
          network.ccipNames.sourceName === tx.sourceNetworkName ||
          network.ccipNames.destName === tx.sourceNetworkName
        );
        
        // Only show transactions from supported networks
        return sourceNetwork !== undefined;
      })
      .map(tx => {
        // Find the network that matches the source network
        const [sourceKey, sourceNetwork] = Object.entries(SUPPORTED_NETWORKS).find(([_, network]) => 
          network.name === tx.sourceNetworkName || 
          network.ccipNames.sourceName === tx.sourceNetworkName ||
          network.ccipNames.destName === tx.sourceNetworkName
        ) || [null, null];

        // Skip if no matching network found
        if (!sourceNetwork) {
          console.log('Skipping CCTP transaction - no matching network found');
          return null;
        }

        return {
          messageId: tx.hash,
          state: tx.status === 'SUCCESS' ? MessageState.SUCCESS :
                 tx.status === 'FAILURE' ? MessageState.FAILURE :
                 MessageState.IN_PROGRESS,
          blockTimestamp: tx.timestamp,
          origin: tx.from,
          receiver: tx.to,
          sourceTxHash: tx.hash,
          destTransactionHash: tx.destTransactionHash || '', // Use the destTransactionHash from CCTP transaction
          tokenAmounts: [{
            amount: tx.amount,
            token: { symbol: 'USDC', decimals: sourceNetwork.contracts.decimal || 6 }
          }],
          protocol: 'CCTP',
          sourceNetworkName: sourceNetwork.name, // Use the network's display name
          destNetworkName: 'Sepolia', // Always set destination to Sepolia
          sourceDecimals: sourceNetwork.contracts.decimal || 6,
          destDecimals: 6 // Sepolia always uses 6 decimals
        };
      })
      .filter(Boolean) // Remove any null entries
  ]
  .filter((tx): tx is NonNullable<typeof tx> => tx !== null) // Type guard to remove nulls
  .sort((a, b) => {
    const timestampA = a.blockTimestamp ? new Date(a.blockTimestamp).getTime() : 0;
    const timestampB = b.blockTimestamp ? new Date(b.blockTimestamp).getTime() : 0;
    return timestampB - timestampA;
  });

  // Update pagination to use allTransactions
  const totalPages = Math.ceil(allTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = allTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Update the useEffect to prevent infinite fetching
  useEffect(() => {
    const fetchBridgingInfo = async () => {
      // Skip if we've already fetched for this page
      if (fetchedPagesRef.current.has(currentPage)) {
        return;
      }

      const currentPageTransactions = paginatedTransactions;
      if (currentPageTransactions.length > 0) {
        const bridgingInfo: Record<string, string | null> = {};
        for (const tx of currentPageTransactions) {
          if (tx.messageId) {
           
            
            try {
              const provider = await stakedUserBalance.getProvider();
              const receipt = await provider.getTransactionReceipt(tx.destTransactionHash);
              

              const ccipLog = receipt?.logs.find(log => log.topics[0] === "0xd0c3c799bf9e2639de44391e7f524d229b2b55f5b1ea94b2bf7da42f7243dddd");
              
              
              const rawData = ccipLog?.data;
              
              if (rawData) {
                const decoded = abiCoder.decode([tupleType], rawData);
                const bridgingMessageId = decoded[0][12];
                
                bridgingInfo[tx.messageId] = bridgingMessageId;
              } else {
                
                bridgingInfo[tx.messageId] = null;
              }
            } catch (error) {
              console.error('Error fetching bridging message ID:', error);
              bridgingInfo[tx.messageId] = null;
            }
          }
        }
        
        setBridgingInfo(prev => ({ ...prev, ...bridgingInfo }));
        // Mark this page as fetched
        fetchedPagesRef.current.add(currentPage);
      }
    };

    fetchBridgingInfo();
  }, [currentPage, paginatedTransactions.length]); // Only run when page changes or transactions length changes

  // Reset fetched pages when transactions change
  useEffect(() => {
    fetchedPagesRef.current.clear();
  }, [transactions]);

  // Update the TransactionModal component to use the correct explorer URLs
  const getExplorerUrl = (txHash: string, networkName: string) => {
    switch (networkName.toLowerCase()) {
      case 'arbitrum sepolia':
        return `https://sepolia.arbiscan.io/tx/${txHash}`;
      case 'base sepolia':
        return `https://sepolia.basescan.org/tx/${txHash}`;
      case 'lisk sepolia':
        return `https://sepolia-blockscout.lisk.com/tx/${txHash}`;
      case 'polygon amoy':
        return `https://www.oklink.com/amoy/tx/${txHash}`;
      case 'sepolia':
        return `https://sepolia.etherscan.io/tx/${txHash}`;
      default:
        return `https://sepolia.arbiscan.io/tx/${txHash}`;
    }
  };

  // Update the TransactionModal component
  const TransactionModal = ({ transaction }: { transaction: any }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={() => setSelectedTx(null)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={`
          ${theme === 'night' ? 'bg-gray-900 text-amber-400' : 'bg-gray-900 text-amber-100'}
          border-2 border-amber-700 rounded-lg p-6 max-w-2xl w-full mx-4 space-y-4
        `}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-medium mb-1">Transaction Details</h3>
            <div className="flex items-center space-x-2 text-sm">
              <div className="flex items-center space-x-1">
                {getStatusIcon(transaction.state)}
                <span className="capitalize">
                  {transaction.state === MessageState.SUCCESS && 'Completed'}
                  {transaction.state === MessageState.IN_PROGRESS && 'In Progress'}
                  {transaction.state === MessageState.FAILURE && 'Failed'}
                  {transaction.state === MessageState.UNTOUCHED && 'Failed'}
                  {transaction.state === null && 'In Progress'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedTx(null)}
            className="p-1 hover:bg-amber-700/30 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 text-sm">
          {transaction.tokenAmounts?.map((token: any, index: number) => (
            <div key={index} className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">Amount</div>
              <div className="text-xl font-medium">
                {formatAmount(token.amount, transaction.sourceDecimals || token.token.decimals)} {'USDC'}
              </div>
            </div>
          ))}

          <div className="grid gap-3">
            <div className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">Message ID</div>
              <a
                href={transaction.protocol === 'CCIP' 
                  ? `https://ccip.chain.link/msg/${transaction.messageId}`
                  : `https://sepolia.arbiscan.io/tx/${transaction.hash || transaction.messageId}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 hover:text-amber-400"
              >
                <span className="break-all">{transaction.messageId}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>

            <div className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">From</div>
              <div className="break-all">{transaction.origin || transaction.sender || 'Pending...'}</div>
            </div>

            <div className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">To</div>
              <div className="break-all">{transaction.receiver || 'Pending...'}</div>
            </div>
          </div>

          <div className={`
            p-3 rounded border border-amber-700/30
            ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
          `}>
            <div className="text-xs opacity-70 mb-1">Source Chain</div>
            <div className="flex items-center space-x-2">
              <span>{transaction.sourceNetworkName || 'Arbitrum Sepolia'}</span>
              {transaction.protocol === 'CCIP' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  CCIP
                </span>
              )}
            </div>
          </div>

          <div className={`
            p-3 rounded border border-amber-700/30
            ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
          `}>
            <div className="text-xs opacity-70 mb-1">Destination Chain</div>
            <div className="flex items-center space-x-2">
              <span>{transaction.destNetworkName || 'Sepolia'}</span>
              {transaction.protocol === 'CCIP' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  CCIP
                </span>
              )}
            </div>
          </div>

          <div className={`
            p-3 rounded border border-amber-700/30
            ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
          `}>
            <div className="text-xs opacity-70 mb-1">Timestamp</div>
            <div>
              {transaction.blockTimestamp ? new Date(transaction.blockTimestamp).toLocaleString() : 'Pending...'}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {transaction.sourceTxHash && (
            <div className={`p-3 rounded border border-amber-700/30 ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}`}>
              <div className="text-xs opacity-70 mb-1">Source Transaction</div>
              <a
                href={getExplorerUrl(transaction.sourceTxHash, transaction.sourceNetworkName)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 hover:text-amber-400"
              >
                <span className="break-all">{transaction.sourceTxHash}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}

          {transaction.destTransactionHash && (
            <div className={`p-3 rounded border border-amber-700/30 ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}`}>
              <div className="text-xs opacity-70 mb-1">Destination Transaction</div>
              <a
                href={getExplorerUrl(transaction.destTransactionHash, transaction.destNetworkName)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 hover:text-amber-400"
              >
                <span className="break-all">{transaction.destTransactionHash}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}

          {transaction.protocol === 'CCIP' && (
            <div className={`p-3 rounded border border-amber-700/30 ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}`}>
              <div className="text-xs opacity-70 mb-1">Bridging Information</div>
              {bridgingInfo[transaction.messageId] ? (
                <a
                  href={`https://ccip.chain.link/msg/${bridgingInfo[transaction.messageId]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 hover:text-amber-400"
                >
                  <span className="break-all">{bridgingInfo[transaction.messageId]}</span>
                  <ArrowUpRight size={14} />
                </a>
              ) : transaction.destTransactionHash ? (
                <a
                  href={`https://sepolia.etherscan.io/tx/${transaction.destTransactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 hover:text-amber-400"
                >
                  <span className="break-all">{transaction.destTransactionHash}</span>
                  <ArrowUpRight size={14} />
                </a>
              ) : (
                <div className="text-sm opacity-70">No bridging information available</div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  // Update the table header to include Protocol column
  const tableHeader = (
    <tr className="bg-amber-900/30 border-b border-amber-700/30">
      <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
      <th className="px-4 py-2 text-left text-sm font-medium">Amount</th>
      <th className="px-4 py-2 text-left text-sm font-medium">Protocol</th>
      <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
      <th className="px-4 py-2 text-left text-sm font-medium">Message ID</th>
    </tr>
  );

  // Update the table row to include Protocol column
  const tableRows = paginatedTransactions.map((tx: any) => (
    <tr 
      key={tx.messageId || tx.hash} 
      className="border-b border-amber-700/30 hover:bg-amber-900/20 cursor-pointer"
      onClick={() => setSelectedTx(tx)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon(tx.state)}
          <span className="capitalize">
            {tx.state === MessageState.SUCCESS && 'Completed'}
            {tx.state === MessageState.IN_PROGRESS && 'In Progress'}
            {(tx.state === MessageState.FAILURE || tx.state === MessageState.UNTOUCHED) && 'Failed'}
            {tx.state === null && 'In Progress'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        {tx.tokenAmounts?.map((token: any, index: number) => (
          <div key={index}>
            {formatAmount(token.amount, tx.sourceDecimals || token.token.decimals)} {'USDC'}
          </div>
        ))}
      </td>
      <td className="px-4 py-3">
        <span className={`
          px-2 py-1 rounded-full text-xs
          ${tx.protocol === 'CCIP' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}
        `}>
          {tx.protocol}
        </span>
      </td>
      <td className="px-4 py-3 text-sm opacity-70">
        {tx.blockTimestamp ? new Date(tx.blockTimestamp).toLocaleString() : 'Pending...'}
      </td>
      <td className="px-4 py-3">
        <a 
          href={tx.protocol === 'CCIP' 
            ? `https://ccip.chain.link/msg/${tx.messageId}`
            : `https://sepolia.arbiscan.io/tx/${tx.hash || tx.messageId}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 hover:text-amber-400"
          onClick={e => e.stopPropagation()}
        >
          <span className="text-sm">{tx.hash || tx.messageId}</span>
          <ArrowUpRight size={14} />
        </a>
      </td>
    </tr>
  ));

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center mb-6">
          <h1 className="text-2xl mb-2">Connect Your Wallet</h1>
          <p className="opacity-70">Please connect your wallet to view transactions</p>
        </div>
        <ConnectKitButton.Custom>
          {({ show , address }) => (
            <Button onClick={() => {
              
              show?.();
            }} size="lg">
              Connect Wallet
            </Button>
          )}
        </ConnectKitButton.Custom>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl mb-1">Transactions</h1>
        <p className="text-sm opacity-70">View your transaction history</p>
      </div>

      <Window title="Transaction History">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
            {/* <div className="flex items-center space-x-2">
              <Filter size={16} />
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-amber-900/20 border border-amber-700/50 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Transactions</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div> */}

            <div className="relative">
              <input
                type="text"
                placeholder="Search by message ID or address..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-64 bg-amber-900/20 border border-amber-700/50 rounded-md pl-8 pr-2 py-1 text-sm focus:outline-none focus:border-amber-500"
              />
              <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-50" />
            </div>
          </div>

          <div className="border border-amber-700/30 rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                <span className="ml-2 text-amber-400">Loading transactions...</span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      {tableHeader}
                    </thead>
                    <tbody>
                      {tableRows}
                    </tbody>
                  </table>
                </div>

                {filteredTransactions.length === 0 && currentStatus?.status !== 'IN_PROGRESS' && (
                  <div className="text-center py-8">
                    <p className="text-sm opacity-70">No transactions found</p>
                  </div>
                )}

                {filteredTransactions.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-amber-900/20 border-t border-amber-700/30">
                    <div className="text-sm opacity-70">
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, allTransactions.length)} of {allTransactions.length} transactions
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-amber-700/30 disabled:opacity-50"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <span className="text-sm px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded hover:bg-amber-700/30 disabled:opacity-50"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Window>

      <AnimatePresence>
        {selectedTx && <TransactionModal transaction={selectedTx} />}
      </AnimatePresence>
    </div>
  );
};

export default Transactions;