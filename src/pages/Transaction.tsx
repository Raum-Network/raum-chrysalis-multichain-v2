import { useState, useEffect } from 'react';
import { useWallet } from '../lib/walletConnect';
import Window from '../components/Window';
import Button from '../components/Button';
import { ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, Filter, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useStakingStore } from '../store/stakingStore';

const ITEMS_PER_PAGE = 5;

const Transactions = () => {
  const { isConnected, connect, address } = useWallet();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const { transactions, fetchTransactions, currentStake } = useStakingStore();

  useEffect(() => {
    if (address) {
      fetchTransactions(address);
    }
  }, [address, fetchTransactions]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'pending':
      case 'in_progress':
        return <Clock size={16} className="text-amber-400" />;
      case 'failed':
      case 'failure':
        return <XCircle size={16} className="text-red-400" />;
      default:
        return null;
    }
  };

  const formatAmount = (amount: string, decimals: number) => {
    return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
  };

  const filteredTransactions = [...transactions]
    .filter(tx => {
      if (filter === 'all') return true;
      return tx.status.toLowerCase() === filter;
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

  // Add current stake to transactions if it exists and is in progress
  const allTransactions = currentStake?.isInProgress 
    ? [{ 
        messageId: currentStake.status?.ccipMessageId || 'pending',
        status: currentStake.status?.status || 'IN_PROGRESS',
        sourceTimestamp: new Date(currentStake.startTimestamp || Date.now()).toISOString(),
        tokenAmounts: [{
          amount: (currentStake.amount * Math.pow(10, 6)).toString(),
          token: {
            symbol: 'USDC',
            decimals: 6
          }
        }]
      }, ...paginatedTransactions]
    : paginatedTransactions;

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
                {getStatusIcon(transaction.status)}
                <span className="capitalize">{transaction.status.toLowerCase()}</span>
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
                {formatAmount(token.amount, token.token.decimals)} {token.token.symbol}
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
              <div className="break-all">{transaction.sender}</div>
            </div>

            <div className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">To</div>
              <div className="break-all">{transaction.receiver}</div>
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
            <div>{new Date(transaction.sourceTimestamp).toLocaleString()}</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

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
                  <tr className="bg-amber-900/30 border-b border-amber-700/30">
                    <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Amount</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Message ID</th>
                  </tr>
                </thead>
                <tbody>
                  {allTransactions.map((tx: any) => (
                    <tr 
                      key={tx.messageId} 
                      className="border-b border-amber-700/30 hover:bg-amber-900/20 cursor-pointer"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(tx.status)}
                          <span className="capitalize">{tx.status.toLowerCase()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {tx.tokenAmounts?.map((token: any, index: number) => (
                          <div key={index}>
                            {formatAmount(token.amount, token.token.decimals)} {token.token.symbol}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-sm opacity-70">
                        {new Date(tx.sourceTimestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <a 
                          href={`https://ccip.chain.link/msg/${tx.messageId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 hover:text-amber-400"
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="text-sm">{tx.messageId}</span>
                          <ArrowUpRight size={14} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length === 0 && !currentStake?.isInProgress && (
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