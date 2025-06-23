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
  const { isConnected, connect, address, chainId } = useWallet();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [currentStatus, setCurrentStatus] = useState<StakeStatus | null>(null);
  const [currentTxState, setCurrentTxState] = useState<string>('1'); // Default to IN_PROGRESS
  const [bridgingInfo, setBridgingInfo] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [cctpTransactions, setCctpTransactions] = useState<CCTPTransaction[]>([]);
  const fetchedPagesRef = useRef<Set<number>>(new Set());

  // Helper to get explorer URL for the current network
  const explorerUrl = chainId
    ? Object.values(SUPPORTED_NETWORKS).find(n => n.chainId === chainId)?.explorer || 'https://sepolia.arbiscan.io'
    : 'https://sepolia.arbiscan.io';

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'IN_PROGRESS':
        return <Clock size={16} className="text-amber-400" />;
      case 'FAILURE':
        return <XCircle size={16} className="text-red-400" />;
      case 'PENDING':
        return <Clock size={16} className="text-amber-400" />;
      default:
        return <Clock size={16} className="text-amber-400" />;
    }
  };

  const formatAmount = (amount: string, decimals: number) => {
    return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
  };

  useEffect(() => {
    const loadTransactions = async () => {
      if (address) {
        setIsLoading(true);
        try {
          const cctpResult = await fetchCCTPTransactions(address, chainId);
          setCctpTransactions(cctpResult);
        } catch (error) {
          console.error('Error fetching CCTP transactions:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadTransactions();
    const interval = setInterval(loadTransactions, 30000);
    return () => clearInterval(interval);
  }, [address, chainId]);

  // Filtering and pagination for CCTP transactions
  const filteredTransactions = cctpTransactions
    .filter(tx => {
      if (filter === 'all') return true;
      switch (filter) {
        case 'completed':
          return tx.status === 'SUCCESS';
        case 'pending':
          return tx.status === 'IN_PROGRESS' || tx.status === 'PENDING';
        case 'failed':
          return tx.status === 'FAILURE';
        default:
          return true;
      }
    })
    .filter(tx =>
      searchQuery === '' ||
      tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.to.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const TransactionModal = ({ transaction }: { transaction: CCTPTransaction }) => (
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
            <h3 className="text-xl font-medium mb-1">CCTP Transaction Details</h3>
            <div className="flex items-center space-x-2 text-sm">
              <div className="flex items-center space-x-1">
                {getStatusIcon(transaction.status)}
                <span className="capitalize">
                  {transaction.status === 'SUCCESS' && 'Completed'}
                  {transaction.status === 'IN_PROGRESS' && 'In Progress'}
                  {transaction.status === 'FAILURE' && 'Failed'}
                  {transaction.status === 'PENDING' && 'Pending'}
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
          <div className={`p-3 rounded border border-amber-700/30 ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}`}>
            <div className="text-xs opacity-70 mb-1">Amount</div>
            <div className="text-xl font-medium">
              {formatAmount(transaction.amount, 6)} {'USDC'}
            </div>
          </div>

          <div className="grid gap-3">
            <div className={`p-3 rounded border border-amber-700/30 ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}`}>
              <div className="text-xs opacity-70 mb-1">Hash</div>
              <a
                href={`${explorerUrl}/tx/${transaction.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 hover:text-amber-400"
              >
                <span className="text-green-500 hover:text-green-600 break-all">{transaction.hash}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
            <div className={`p-3 rounded border border-amber-700/30 ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}`}>
              <div className="text-xs opacity-70 mb-1">From</div>
              <div className="break-all">{transaction.from}</div>
            </div>
            <div className={`p-3 rounded border border-amber-700/30 ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}`}>
              <div className="text-xs opacity-70 mb-1">To</div>
              <div className="break-all">{transaction.to}</div>
            </div>
          </div>

          <div className={`p-3 rounded border border-amber-700/30 ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}`}>
            <div className="text-xs opacity-70 mb-1">Timestamp</div>
            <div>
              {transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'Pending...'}
            </div>
          </div>

          {transaction.destTransactionHash && (
            <div
              className={`p-3 rounded border border-amber-700/30 ${
                theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'
              }`}
            >
              <div className="text-xs opacity-70 mb-1">Destination Transaction</div>
              <a
                href={`https://sepolia.etherscan.io/tx/${transaction.destTransactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-green-500 hover:text-green-600 break-all"
              >
                <span>{transaction.destTransactionHash}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  const tableHeader = (
    <tr className="bg-amber-900/30 border-b border-amber-700/30">
      <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
      <th className="px-4 py-2 text-left text-sm font-medium">Amount</th>
      <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
      <th className="px-4 py-2 text-left text-sm font-medium">Hash</th>
    </tr>
  );

  const tableRows = paginatedTransactions.map((tx: CCTPTransaction) => (
    <tr 
      key={tx.hash} 
      className="border-b border-amber-700/30 hover:bg-amber-900/20 cursor-pointer"
      onClick={() => setSelectedTx(tx)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon(tx.status)}
          <span className="capitalize">
            {tx.status === 'SUCCESS' && 'Completed'}
            {tx.status === 'IN_PROGRESS' && 'In Progress'}
            {tx.status === 'FAILURE' && 'Failed'}
            {tx.status === 'PENDING' && 'Pending'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        {formatAmount(tx.amount, 6)} {'USDC'}
      </td>
      <td className="px-4 py-3 text-sm opacity-70">
        {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Pending...'}
      </td>
      <td className="px-4 py-3">
        <a 
          href={`${explorerUrl}/tx/${tx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 hover:text-amber-400"
          onClick={e => e.stopPropagation()}
        >
          <span className="text-sm">{tx.hash}</span>
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
        <h1 className="text-2xl mb-1">CCTP Transactions</h1>
        <p className="text-sm opacity-70">View your CCTP transaction history</p>
      </div>

      <Window title="CCTP Transaction History">
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
                placeholder="Search by hash or address..."
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

                {filteredTransactions.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm opacity-70">No CCTP transactions found</p>
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