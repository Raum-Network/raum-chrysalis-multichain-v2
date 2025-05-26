import { useState, useEffect } from 'react';
import { useWallet } from '../lib/walletConnect';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import Window from '../components/Window';
import Button from '../components/Button';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, Filter, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useStakingStore } from '../store/stakingStore';
import { getCCIPStatus } from '../services/api';
import { CCTPTransaction, fetchCCTPTransactions } from '../services/cctpTransactions';

const ITEMS_PER_PAGE = 5;

// First, update the MessageState mapping to match the API response
const MessageState = {
  UNTOUCHED: 0,
  IN_PROGRESS: 1,
  SUCCESS: 2,
  FAILURE: 3
} as const;

type TransactionState = typeof MessageState[keyof typeof MessageState];

interface Transaction {
  state: TransactionState;
  messageId: string;
  // ... other properties
}



const Transactions = () => {
  const { isConnected, connect, address } = useWallet();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const { transactions, fetchTransactions } = useStakingStore();
  const [currentStatus, setCurrentStatus] = useState<StakeStatus | null>(null);
  const [currentTxState, setCurrentTxState] = useState<string>('1'); // Default to IN_PROGRESS

  // Add CCTP transactions state
  const [cctpTransactions, setCctpTransactions] = useState<CCTPTransaction[]>([]);

  useEffect(() => {
    if (address) {
      fetchTransactions(address);
    }
  }, [address, fetchTransactions]);

  // Update the useEffect to fetch both CCIP and CCTP transactions
  useEffect(() => {
    const loadTransactions = async () => {
      if (address) {
        // Fetch both types of transactions
        await fetchTransactions(address);
        
        try {
          const cctpTxs = await fetchCCTPTransactions(address);
          setCctpTransactions(cctpTxs);
        } catch (error) {
          console.error('Error fetching CCTP transactions:', error);
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

  // Update the getStatusIcon function
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
      tx.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.receiver.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Update the transaction mapping for current stake
  const allTransactions = [
    ...(currentStatus?.status === 'IN_PROGRESS' ? [{
      messageId: currentStatus.ccipMessageId || 'Pending...',
      state: currentTxState === '2' ? MessageState.SUCCESS :
             currentTxState === '3' ? MessageState.FAILURE :
             currentTxState === '1' ? MessageState.IN_PROGRESS : 
             MessageState.UNTOUCHED,
      blockTimestamp: currentStatus.timestamp || Date.now(),
      origin: currentStatus.origin || address,
      receiver: currentStatus.receiver,
      sourceTxHash: currentStatus.sourceTxHash,
      destinationTxHash: currentStatus.destinationTxHash,
      tokenAmounts: [{
        amount: currentStatus.amount?.toString() || '0',
        token: { symbol: 'USDC', decimals: 6 }
      }],
      protocol: 'CCIP'
    }] : []),
    ...paginatedTransactions.map(tx => ({ 
      ...tx, 
      protocol: 'CCIP',
      blockTimestamp: tx.blockTimestamp
    })),
    ...cctpTransactions.map(tx => ({
      messageId: tx.hash, // Use hash as messageId for CCTP
      state: tx.status === 'SUCCESS' ? MessageState.SUCCESS :
             tx.status === 'FAILURE' ? MessageState.FAILURE :
             MessageState.IN_PROGRESS,
      blockTimestamp: tx.timestamp,
      origin: tx.from,
      receiver: tx.to,
      sourceTxHash: tx.hash,
      tokenAmounts: [{
        amount: tx.amount,
        token: { symbol: 'USDC', decimals: 6 }
      }],
      protocol: 'CCTP',
      sourceChainName: 'Arbitrum Sepolia',
      destinationChainName: 'Sepolia'
    }))
  ].sort((a, b) => (b.blockTimestamp || 0) - (a.blockTimestamp || 0));

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
                {formatAmount(token.amount, 18)} {'USDC'}
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
                href={`https://ccip.chain.link/msg/${transaction.messageId}`}
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
            <div>{transaction.sourceChainName || 'Arbitrum Sepolia'}</div>
          </div>

          <div className={`
            p-3 rounded border border-amber-700/30
            ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
          `}>
            <div className="text-xs opacity-70 mb-1">Destination Chain</div>
            <div>{transaction.destinationChainName || 'Sepolia'}</div>
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
                href={`https://sepolia.arbiscan.io/tx/${transaction.sourceTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 hover:text-amber-400"
              >
                <span className="break-all">{transaction.sourceTxHash}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}

          {transaction.destinationTxHash && (
            <div className={`p-3 rounded border border-amber-700/30 ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}`}>
              <div className="text-xs opacity-70 mb-1">Destination Transaction</div>
              <a
                href={`https://sepolia.etherscan.io/tx/${transaction.destinationTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 hover:text-amber-400"
              >
                <span className="break-all">{transaction.destinationTxHash}</span>
                <ArrowUpRight size={14} />
              </a>
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
  const tableRows = allTransactions.map((tx: any) => (
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
            {formatAmount(token.amount, 6)} {'USDC'}
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
        <Button onClick={connect} size="lg">Connect Wallet</Button>
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
            <div className="flex items-center space-x-2">
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
            </div>

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
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length} transactions
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