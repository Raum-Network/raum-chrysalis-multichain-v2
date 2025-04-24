import { useState } from 'react';
import { useWallet } from '../lib/walletConnect';
import Window from '../components/Window';
import Button from '../components/Button';
import { ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, Filter, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

interface Transaction {
  id: string;
  type: 'stake' | 'unstake' | 'reward' | 'transfer';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  timestamp: Date;
  hash: string;
  from?: string;
  to?: string;
  gas?: number;
  nonce?: number;
}

const ITEMS_PER_PAGE = 5;

const Transactions = () => {
  const { isConnected, connect } = useWallet();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<'all' | 'stake' | 'unstake' | 'reward' | 'transfer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Mock transactions data with additional details
  const transactions: Transaction[] = Array.from({ length: 15 }, (_, i) => ({
    id: `${i + 1}`,
    type: ['stake', 'unstake', 'reward', 'transfer'][Math.floor(Math.random() * 4)] as Transaction['type'],
    amount: parseFloat((Math.random() * 5).toFixed(3)),
    status: ['completed', 'pending', 'failed'][Math.floor(Math.random() * 3)] as Transaction['status'],
    timestamp: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000),
    hash: `0x${Math.random().toString(16).substr(2, 40)}`,
    from: `0x${Math.random().toString(16).substr(2, 40)}`,
    to: `0x${Math.random().toString(16).substr(2, 40)}`,
    gas: Math.floor(Math.random() * 200000),
    nonce: Math.floor(Math.random() * 1000)
  }));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'pending':
        return <Clock size={16} className="text-amber-400" />;
      case 'failed':
        return <XCircle size={16} className="text-red-400" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'stake':
        return <ArrowDownRight size={16} className="text-green-400" />;
      case 'unstake':
        return <ArrowUpRight size={16} className="text-red-400" />;
      case 'reward':
        return <CheckCircle2 size={16} className="text-amber-400" />;
      case 'transfer':
        return <ArrowUpRight size={16} className="text-blue-400" />;
      default:
        return null;
    }
  };

  const filteredTransactions = transactions
    .filter(tx => filter === 'all' || tx.type === filter)
    .filter(tx => 
      searchQuery === '' || 
      tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.amount.toString().includes(searchQuery)
    );

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const TransactionModal = ({ transaction }: { transaction: Transaction }) => (
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
              {getTypeIcon(transaction.type)}
              <span className="capitalize">{transaction.type}</span>
              <span className="opacity-50">•</span>
              <div className="flex items-center space-x-1">
                {getStatusIcon(transaction.status)}
                <span className="capitalize">{transaction.status}</span>
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
          <div className={`
            p-3 rounded border border-amber-700/30
            ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
          `}>
            <div className="text-xs opacity-70 mb-1">Amount</div>
            <div className="text-xl font-medium">{transaction.amount} ETH</div>
          </div>

          <div className="grid gap-3">
            <div className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">Transaction Hash</div>
              <a
                href={`https://etherscan.io/tx/${transaction.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 hover:text-amber-400"
              >
                <span className="break-all">{transaction.hash}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>

            <div className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">From</div>
              <div className="break-all">{transaction.from}</div>
            </div>

            <div className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">To</div>
              <div className="break-all">{transaction.to}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">Gas Used</div>
              <div>{transaction.gas?.toLocaleString()}</div>
            </div>

            <div className={`
              p-3 rounded border border-amber-700/30
              ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
            `}>
              <div className="text-xs opacity-70 mb-1">Nonce</div>
              <div>{transaction.nonce}</div>
            </div>
          </div>

          <div className={`
            p-3 rounded border border-amber-700/30
            ${theme === 'night' ? 'bg-amber-900/20' : 'bg-amber-700/10'}
          `}>
            <div className="text-xs opacity-70 mb-1">Timestamp</div>
            <div>{transaction.timestamp.toLocaleString()}</div>
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
                <option value="stake">Stakes</option>
                <option value="unstake">Unstakes</option>
                <option value="reward">Rewards</option>
                <option value="transfer">Transfers</option>
              </select>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search by hash or amount..."
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
                    <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Amount</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Transaction Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      className="border-b border-amber-700/30 hover:bg-amber-900/20 cursor-pointer"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {getTypeIcon(tx.type)}
                          <span className="capitalize">{tx.type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {tx.amount} ETH
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(tx.status)}
                          <span className="capitalize">{tx.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm opacity-70">
                        {tx.timestamp.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <a 
                          href={`https://etherscan.io/tx/${tx.hash}`}
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
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length === 0 && (
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