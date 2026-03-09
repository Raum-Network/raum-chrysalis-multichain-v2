import { useState, useEffect, useMemo, useRef } from 'react';
import { useWallet } from '../lib/walletConnect';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import Window from '../components/Window';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useStakingStore } from '../store/stakingStore';
import { getCCIPStatus } from '../services/api';
import { CCTPTransaction, fetchCCTPTransactions } from '../services/cctpTransactions';
import { SUPPORTED_NETWORKS } from '../config/contract';
import { ethers } from 'ethers';
import stakedUserBalance from '../lib/sepoliaContract';
import ReactGA from 'react-ga4';
import { useStaking } from '../hooks/useStaking';
import { getTxExplorerUrl } from '../lib/networkSupport';
import { PersistedTransaction, getPersistedTransactions } from '../services/transactionRepository';

const ITEMS_PER_PAGE = 5;

// First, update the MessageState mapping to match the API response
const MessageState = {
  UNTOUCHED: 0,
  IN_PROGRESS: 1,
  SUCCESS: 2,
  FAILURE: 3
} as const;

type TransactionState = typeof MessageState[keyof typeof MessageState];
type TransactionProtocol = 'CCIP' | 'CCTP' | 'Axelar ITS';

type DisplayTokenAmount = {
  amount: string;
  token: {
    symbol: string;
    decimals: number;
  };
};

type DisplayTransaction = {
  messageId: string;
  state: TransactionState | null;
  blockTimestamp: number | string | null;
  origin?: string | null;
  sender?: string | null;
  receiver?: string | null;
  sourceTxHash?: string;
  destTransactionHash?: string;
  hash?: string;
  tokenAmounts: DisplayTokenAmount[];
  protocol: TransactionProtocol;
  sourceNetworkName: string;
  destNetworkName: string;
  sourceDecimals: number;
  destDecimals: number;
};

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

const toTransactionState = (state: number): TransactionState => {
  if (state === MessageState.SUCCESS) return MessageState.SUCCESS;
  if (state === MessageState.FAILURE) return MessageState.FAILURE;
  if (state === MessageState.IN_PROGRESS) return MessageState.IN_PROGRESS;
  return MessageState.UNTOUCHED;
};

const isInProgressState = (state: TransactionState | null) =>
  state === MessageState.IN_PROGRESS || state === MessageState.UNTOUCHED || state === null;

const Transactions = () => {
  const { isConnected, address, networkConfig } = useWallet();
  const { theme } = useTheme();
  const { stakingNFTs, stakingOffers, supportedProtocols } = useStaking();
  const [filter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<DisplayTransaction | null>(null);
  const { transactions, fetchTransactions } = useStakingStore();
  const [currentStatus, setCurrentStatus] = useState<StakeStatus | null>(null);
  const [currentTxState, setCurrentTxState] = useState<string>('1'); // Default to IN_PROGRESS
  const [bridgingInfo, setBridgingInfo] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [cctpTransactions, setCctpTransactions] = useState<CCTPTransaction[]>([]);
  const [persistedTransactions, setPersistedTransactions] = useState<PersistedTransaction[]>([]);
  const fetchedPagesRef = useRef<Set<number>>(new Set());
  const isRippleNetwork = supportedProtocols.includes('Axelar ITS');

  // Helper functions
  const getStatusIcon = (state: TransactionState | null) => {
    switch (state) {
      case MessageState.SUCCESS:
        return <CheckCircle2 size={16} className="text-green-400" />;
      case MessageState.IN_PROGRESS:
      case MessageState.UNTOUCHED:
        return <Clock size={16} className="text-[rgb(var(--signal))]" />;
      case MessageState.FAILURE:
        return <XCircle size={16} className="text-red-400" />;
      default:
        return <Clock size={16} className="text-[rgb(var(--signal))]" />;
    }
  };

  const formatAmount = (amount: string, decimals: number) => {
    return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
  };

  const getMessageUrl = (tx: DisplayTransaction) => {
    if (tx.protocol === 'CCIP') {
      return `https://ccip.chain.link/msg/${tx.messageId}`;
    }
    if (tx.protocol === 'Axelar ITS') {
      return `https://testnet.axelarscan.io/gmp/${tx.hash || tx.messageId}`;
    }
    return getTxExplorerUrl(tx.hash || tx.messageId, tx.sourceNetworkName, tx.protocol);
  };

  useEffect(() => {

    if (address) {
      ReactGA.event({
        category: 'Wallet',
        action: 'Click',
        label: `Connected Wallet ${address}`
      });
    }
  }, [address])

  // Update the useEffect to load both types of transactions together
  useEffect(() => {
    const loadTransactions = async () => {
      if (address) {
        setIsLoading(true);

        try {
          const persistedResult = await getPersistedTransactions(address);
          setPersistedTransactions(persistedResult);
          setIsLoading(false);

          const [ccipResult, cctpResult] = await Promise.allSettled([
            fetchTransactions(address),
            fetchCCTPTransactions(address),
          ]);

          if (ccipResult.status === 'rejected') {
            console.error('Error fetching CCIP transactions:', ccipResult.reason);
          }

          if (cctpResult.status === 'fulfilled') {
            setCctpTransactions(cctpResult.value);
          } else {
            console.error('Error fetching CCTP transactions:', cctpResult.reason);
            setCctpTransactions([]);
          }
        } catch (error) {
          console.error('Error fetching transactions:', error);
          setCctpTransactions([]);
          setPersistedTransactions([]);
          setIsLoading(false);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadTransactions();

    // Polling for updates every 30 seconds
    const interval = setInterval(loadTransactions, 30000);
    return () => clearInterval(interval);
  }, [address, fetchTransactions, networkConfig.name]);

  const resolveSourceNetwork = (sourceName?: string) => {
    if (!sourceName) return null;
    return Object.values(SUPPORTED_NETWORKS).find((network) =>
      network.name === sourceName ||
      network.ccipNames.sourceName === sourceName ||
      network.ccipNames.destName === sourceName
    ) ?? null;
  };

  // Build Axelar ITS transactions from staking NFT receipts (Ripple Testnet only)
  const itsTransactions = useMemo<DisplayTransaction[]>(
    () => (isRippleNetwork
      ? [...stakingNFTs, ...stakingOffers].map(item => ({
        messageId: item.receipt.txHash || item.id,
        state: MessageState.SUCCESS,
        blockTimestamp: item.receipt.stakedAt ? item.receipt.stakedAt * 1000 : Date.now(),
        origin: item.receipt.staker || address || null,
        sender: item.receipt.staker || address || null,
        receiver: SUPPORTED_NETWORKS['ripple-testnet'].contracts.cctpDestinationCaller || address || null,
        sourceTxHash: item.receipt.txHash || '',
        destTransactionHash: '',
        hash: item.receipt.txHash || item.id,
        tokenAmounts: [{
          amount: String(Number(item.receipt.amount) * 1_000_000),
          token: { symbol: 'XRP', decimals: 6 }
        }],
        protocol: 'Axelar ITS',
        sourceNetworkName: 'Ripple Testnet',
        destNetworkName: 'Sepolia',
        sourceDecimals: 6,
        destDecimals: 6
      }))
      : []),
    [address, isRippleNetwork, stakingNFTs, stakingOffers]
  );

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

    if (currentStatus?.ccipMessageId && currentStatus?.status === null) {
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
  const allTransactions = useMemo<DisplayTransaction[]>(() => {
    const mappedPersistedTransactions: DisplayTransaction[] = persistedTransactions
      .filter((tx) => {
        if (tx.sourceNetworkName !== networkConfig.name) return false;
        if (searchQuery === '') return true;
        const query = searchQuery.toLowerCase();
        return tx.messageId.toLowerCase().includes(query) ||
          tx.sourceTxHash.toLowerCase().includes(query) ||
          (tx.sender || '').toLowerCase().includes(query) ||
          (tx.receiver || '').toLowerCase().includes(query);
      })
      .map((tx) => ({
        messageId: tx.messageId,
        hash: tx.sourceTxHash,
        state: tx.status === 'SUCCESS'
          ? MessageState.SUCCESS
          : tx.status === 'FAILURE'
            ? MessageState.FAILURE
            : MessageState.IN_PROGRESS,
        blockTimestamp: tx.updatedAt || tx.createdAt,
        origin: tx.sender || null,
        sender: tx.sender || null,
        receiver: tx.receiver || null,
        sourceTxHash: tx.sourceTxHash,
        destTransactionHash: tx.destinationTxHash || '',
        tokenAmounts: [{
          amount: tx.amount,
          token: {
            symbol: tx.assetSymbol,
            decimals: tx.sourceDecimals || 6
          }
        }],
        protocol: tx.protocol,
        sourceNetworkName: tx.sourceNetworkName,
        destNetworkName: tx.destNetworkName || 'Sepolia',
        sourceDecimals: tx.sourceDecimals || 6,
        destDecimals: tx.destDecimals || 6
      }));

    const currentProtocol = currentStatus?.protocol || 'CCIP';
    const currentStakeTransactions: DisplayTransaction[] =
      currentStatus?.status === 'IN_PROGRESS' && currentStatus?.sourceNetworkName === networkConfig.name
        ? [{
          messageId: currentStatus.ccipMessageId || 'Pending...',
          state: currentTxState === '2' ? MessageState.SUCCESS :
            currentTxState === '3' ? MessageState.FAILURE :
              currentTxState === '1' ? MessageState.IN_PROGRESS :
                MessageState.UNTOUCHED,
          blockTimestamp: currentStatus.timestamp || Date.now(),
          origin: currentStatus.origin || address || null,
          sender: currentStatus.origin || address || null,
          receiver: currentStatus.receiver || null,
          sourceTxHash: currentStatus.sourceTxHash,
          destTransactionHash: currentStatus.destinationTxHash || '',
          tokenAmounts: [{
            amount: currentStatus.amount?.toString() || '0',
            token: {
              symbol: currentProtocol === 'Axelar ITS' ? 'XRP' : 'USDC',
              decimals: currentStatus.sourceDecimals || 6
            }
          }],
          protocol: currentProtocol,
          sourceNetworkName: currentStatus.sourceNetworkName || 'Arbitrum Sepolia',
          destNetworkName: 'Sepolia',
          sourceDecimals: currentStatus.sourceDecimals || 6,
          destDecimals: 6
        }]
        : [];

    const mappedCcipTransactions: DisplayTransaction[] = filteredTransactions
      .filter((tx) => tx.sourceNetworkName === networkConfig.name)
      .map((tx) => {
        const sourceNetwork = resolveSourceNetwork(tx.sourceNetworkName);
        if (!sourceNetwork) return null;

        const sourceDecimals = sourceNetwork.contracts.decimal || 6;
        return {
          messageId: tx.messageId,
          hash: tx.sourceTxHash || tx.messageId,
          state: toTransactionState(tx.state),
          blockTimestamp: tx.blockTimestamp ?? null,
          origin: tx.sender || null,
          sender: tx.sender || null,
          receiver: tx.receiver || null,
          sourceTxHash: tx.sourceTxHash || tx.messageId,
          destTransactionHash: tx.destTransactionHash || tx.destinationTxHash || '',
          tokenAmounts: (tx.tokenAmounts || []).map((token) => ({
            amount: token.amount,
            token: {
              symbol: token.token.symbol,
              decimals: sourceDecimals
            }
          })),
          protocol: 'CCIP',
          sourceNetworkName: sourceNetwork.name,
          destNetworkName: 'Sepolia',
          sourceDecimals,
          destDecimals: 6
        };
      })
      .filter((tx): tx is DisplayTransaction => tx !== null);

    const mappedCctpTransactions: DisplayTransaction[] = cctpTransactions
      .filter((tx) => {
        if (tx.sourceNetworkName !== networkConfig.name) return false;
        if (searchQuery === '') return true;
        return tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.to.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .map((tx) => {
        const sourceNetwork = resolveSourceNetwork(tx.sourceNetworkName);
        if (!sourceNetwork) {
          console.log('Skipping CCTP transaction - no matching network found');
          return null;
        }

        const sourceDecimals = sourceNetwork.contracts.decimal || 6;
        return {
          messageId: tx.hash,
          hash: tx.hash,
          state: tx.status === 'SUCCESS' ? MessageState.SUCCESS :
            tx.status === 'FAILURE' ? MessageState.FAILURE :
              MessageState.IN_PROGRESS,
          blockTimestamp: tx.timestamp,
          origin: tx.from,
          sender: tx.from,
          receiver: tx.to,
          sourceTxHash: tx.hash,
          destTransactionHash: tx.destTransactionHash || '',
          tokenAmounts: [{
            amount: tx.amount,
            token: { symbol: 'USDC', decimals: sourceDecimals }
          }],
          protocol: 'CCTP',
          sourceNetworkName: sourceNetwork.name,
          destNetworkName: 'Sepolia',
          sourceDecimals,
          destDecimals: 6
        };
      })
      .filter((tx): tx is DisplayTransaction => tx !== null);

    const mergedTransactionMap = new Map<string, DisplayTransaction>();
    const mergeCandidates = [
      ...mappedPersistedTransactions,
      ...currentStakeTransactions,
      ...mappedCcipTransactions,
      ...mappedCctpTransactions,
      ...itsTransactions
    ];

    for (const tx of mergeCandidates) {
      const key = `${tx.protocol}:${tx.sourceTxHash || tx.hash || tx.messageId}`;
      const existing = mergedTransactionMap.get(key);
      if (!existing) {
        mergedTransactionMap.set(key, tx);
        continue;
      }

      const existingTimestamp = existing.blockTimestamp ? new Date(existing.blockTimestamp).getTime() : 0;
      const nextTimestamp = tx.blockTimestamp ? new Date(tx.blockTimestamp).getTime() : 0;
      const existingFinal = existing.state === MessageState.SUCCESS || existing.state === MessageState.FAILURE;
      const nextFinal = tx.state === MessageState.SUCCESS || tx.state === MessageState.FAILURE;

      if ((nextFinal && !existingFinal) || nextTimestamp >= existingTimestamp) {
        mergedTransactionMap.set(key, tx);
      }
    }

    return Array.from(mergedTransactionMap.values())
      .sort((a, b) => {
        const timestampA = a.blockTimestamp ? new Date(a.blockTimestamp).getTime() : 0;
        const timestampB = b.blockTimestamp ? new Date(b.blockTimestamp).getTime() : 0;
        return timestampB - timestampA;
      });
  }, [
    address,
    cctpTransactions,
    persistedTransactions,
    currentStatus,
    currentTxState,
    filteredTransactions,
    itsTransactions,
    networkConfig.name,
    searchQuery
  ]);

  // Update pagination to use allTransactions
  const totalPages = Math.ceil(allTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(
    () => allTransactions.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    ),
    [allTransactions, currentPage]
  );
  const inProgressCount = useMemo(
    () => allTransactions.filter((tx) => isInProgressState(tx.state)).length,
    [allTransactions]
  );
  const completedCount = useMemo(
    () => allTransactions.filter((tx) => tx.state === MessageState.SUCCESS).length,
    [allTransactions]
  );
  const failedCount = useMemo(
    () => allTransactions.filter((tx) => tx.state === MessageState.FAILURE).length,
    [allTransactions]
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
  }, [currentPage, paginatedTransactions]);

  // Reset fetched pages when transactions change
  useEffect(() => {
    fetchedPagesRef.current.clear();
  }, [transactions, cctpTransactions, persistedTransactions, networkConfig.name]);

  // Update the TransactionModal component
  const TransactionModal = ({ transaction }: { transaction: DisplayTransaction }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={() => setSelectedTx(null)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={`
          ${theme === 'night' ? 'text-slate-100' : 'text-slate-900'}
          premium-card rounded-2xl p-6 max-w-2xl w-full mx-4 space-y-4 border border-black/5
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
                  {isInProgressState(transaction.state) && 'In Progress'}
                  {transaction.state === MessageState.FAILURE && 'Failed'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedTx(null)}
            className="rounded-full p-1 hover:bg-black/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 text-sm">
          {transaction.tokenAmounts.map((token, index) => (
            <div key={index} className={`
              p-3 rounded-lg border border-black/5
              ${theme === 'night' ? 'bg-white/5 border-white/10' : 'bg-black/[0.02]'}
            `}>
              <div className="eyebrow mb-1">Amount</div>
              <div className="text-xl font-medium">
                {formatAmount(token.amount, transaction.sourceDecimals || token.token.decimals)} {transaction.protocol === 'Axelar ITS' ? 'XRP' : 'USDC'}
              </div>
            </div>
          ))}

          <div className="grid gap-3">
            <div className={`
              p-3 rounded-lg border border-black/5
              ${theme === 'night' ? 'bg-white/5 border-white/10' : 'bg-black/[0.02]'}
            `}>
              <div className="eyebrow mb-1">Message ID</div>
              <a
                href={getMessageUrl(transaction)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-[rgb(var(--accent-strong))] hover:opacity-80"
              >
                <span className="break-all">{transaction.messageId}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>

            <div className={`
              p-3 rounded-lg border border-black/5
              ${theme === 'night' ? 'bg-white/5 border-white/10' : 'bg-black/[0.02]'}
            `}>
              <div className="eyebrow mb-1">From</div>
              <div className="break-all">{transaction.origin || transaction.sender || 'Pending...'}</div>
            </div>

            <div className={`
              p-3 rounded-lg border border-black/5
              ${theme === 'night' ? 'bg-white/5 border-white/10' : 'bg-black/[0.02]'}
            `}>
              <div className="eyebrow mb-1">To</div>
              <div className="break-all">{transaction.receiver || 'Pending...'}</div>
            </div>
          </div>

          <div className={`
            p-3 rounded-lg border border-black/5
            ${theme === 'night' ? 'bg-white/5 border-white/10' : 'bg-black/[0.02]'}
          `}>
            <div className="eyebrow mb-1">Source Chain</div>
            <div className="flex items-center space-x-2">
              <span>{transaction.sourceNetworkName || 'Arbitrum Sepolia'}</span>
              {transaction.protocol === 'CCIP' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                  CCIP
                </span>
              )}
            </div>
          </div>

          {/* Remove Destination Chain for both CCIP and CCTP */}
          {/* <div className={`
            p-3 rounded-lg border border-amber-700/30
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
          </div> */}

          <div className={`
            p-3 rounded border border-black/5
            ${theme === 'night' ? 'bg-white/5 border-white/10' : 'bg-black/[0.02]'}
          `}>
            <div className="eyebrow mb-1">Timestamp</div>
            <div>
              {transaction.blockTimestamp ? new Date(transaction.blockTimestamp).toLocaleString() : 'Pending...'}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {transaction.sourceTxHash && (
            <div className={`p-3 rounded-lg border border-black/5 ${theme === 'night' ? 'bg-white/5 border-white/10' : 'bg-black/[0.02]'}`}>
              <div className="eyebrow mb-1">Source Transaction</div>
              <a
                href={getTxExplorerUrl(transaction.sourceTxHash, transaction.sourceNetworkName, transaction.protocol)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-[rgb(var(--accent-strong))] hover:opacity-80"
              >
                <span className="break-all">{transaction.sourceTxHash}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}

          {/* Only show Destination Transaction for non-CCIP protocols */}
          {transaction.destTransactionHash && transaction.protocol !== 'CCIP' && (
            <div className={`p-3 rounded-lg border border-black/5 ${theme === 'night' ? 'bg-white/5 border-white/10' : 'bg-black/[0.02]'}`}>
              <div className="eyebrow mb-1">Destination Transaction</div>
              <a
                href={getTxExplorerUrl(transaction.destTransactionHash, transaction.destNetworkName, transaction.protocol)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-[rgb(var(--accent-strong))] hover:opacity-80"
              >
                <span className="break-all">{transaction.destTransactionHash}</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}

          {transaction.protocol === 'CCIP' && (
            <div className={`p-3 rounded-lg border border-black/5 ${theme === 'night' ? 'bg-white/5 border-white/10' : 'bg-black/[0.02]'}`}>
              <div className="eyebrow mb-1">Bridging Information</div>
              {bridgingInfo[transaction.messageId] ? (
                <a
                  href={`https://ccip.chain.link/msg/${bridgingInfo[transaction.messageId]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-[rgb(var(--accent-strong))] hover:opacity-80"
                >
                  <span className="break-all">{bridgingInfo[transaction.messageId]}</span>
                  <ArrowUpRight size={14} />
                </a>
              ) : transaction.destTransactionHash ? (
                <a
                  href={`https://sepolia.etherscan.io/tx/${transaction.destTransactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-[rgb(var(--accent-strong))] hover:opacity-80"
                >
                  <span className="break-all">{transaction.destTransactionHash}</span>
                  <ArrowUpRight size={14} />
                </a>
              ) : (
                <div className="muted-copy text-sm">No bridging information available</div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  // Update the table header to include Protocol column
  const tableHeader = (
    <tr className="border-b border-black/10 bg-black/[0.03]">
      <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-500 font-medium">Status</th>
      <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-500 font-medium">Amount</th>
      <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-500 font-medium">Protocol</th>
      <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-500 font-medium">Date</th>
      <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-500 font-medium">Message ID</th>
    </tr>
  );

  // Update the table row to include Protocol column
  const tableRows = paginatedTransactions.map((tx) => (
    <tr
      key={tx.messageId || tx.hash}
      className="cursor-pointer border-b border-black/10 transition-colors hover:bg-black/[0.03]"
      onClick={() => setSelectedTx(tx)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon(tx.state)}
          {tx.state === MessageState.SUCCESS && (
            <span className="capitalize text-xs px-2 py-1 rounded-full border border-emerald-500/35 bg-emerald-500/12 text-emerald-700">Completed</span>
          )}
          {isInProgressState(tx.state) && (
            <span className="capitalize text-xs px-2 py-1 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-700">In Progress</span>
          )}
          {tx.state === MessageState.FAILURE && (
            <span className="capitalize text-xs px-2 py-1 rounded-full border border-red-500/35 bg-red-500/12 text-red-700">Failed</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {tx.tokenAmounts.map((token, index) => (
          <div key={index} className="font-medium text-slate-900">
            {formatAmount(token.amount, tx.sourceDecimals || token.token.decimals)} {tx.protocol === 'Axelar ITS' ? 'XRP' : 'USDC'}
          </div>
        ))}
      </td>
      <td className="px-4 py-3">
        <span className={`
          px-2 py-1 rounded-full text-xs
          ${tx.protocol === 'CCIP'
            ? 'bg-blue-500/20 text-blue-400'
            : tx.protocol === 'CCTP'
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-amber-500/20 text-amber-700'}
        `}>
          {tx.protocol}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">
        {tx.blockTimestamp ? new Date(tx.blockTimestamp).toLocaleString() : 'Pending...'}
      </td>
      <td className="px-4 py-3">
        <a
          href={getMessageUrl(tx)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 text-slate-800 hover:text-[rgb(var(--accent-strong))]"
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
      </div>
    );
  }

  return (
    <div className="route-scroll">
      <div className="page-canvas page-wide flex min-h-full flex-col gap-4">
      <div className="premium-surface rounded-[32px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="eyebrow mb-2">Execution ledger</div>
            <h1 className="text-3xl md:text-4xl font-semibold mb-1">Transactions</h1>
            <p className="muted-copy text-sm md:text-base">Track every protocol leg and status transition in one stream.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="premium-pill rounded-full px-3 py-1.5">{networkConfig.name}</span>
            <span className="premium-card rounded-full px-3 py-1.5">{supportedProtocols.join(' / ')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="premium-card rounded-[24px] p-4">
          <div className="eyebrow">In Progress</div>
          <div className="text-2xl font-semibold mt-2">{inProgressCount}</div>
        </div>
        <div className="premium-card rounded-[24px] p-4">
          <div className="eyebrow">Completed</div>
          <div className="text-2xl font-semibold mt-2 text-emerald-600">{completedCount}</div>
        </div>
        <div className="premium-card rounded-[24px] p-4">
          <div className="eyebrow">Failed</div>
          <div className="text-2xl font-semibold mt-2 text-red-300">{failedCount}</div>
        </div>
      </div>

      <Window title="Transaction History" className="flex-1">
        <div className="flex h-full min-h-0 flex-col p-2 sm:p-3">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row">
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
                className="w-full sm:w-72 premium-card rounded-2xl pl-8 pr-3 py-3 text-sm focus:outline-none focus:border-[rgba(var(--accent),0.24)]"
              />
              <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-50" />
            </div>
          </div>

          <div className="premium-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[rgb(var(--accent-strong))]" />
                <span className="ml-2 text-[rgb(var(--accent-strong))]">Loading transactions...</span>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full">
                    <thead>
                      {tableHeader}
                    </thead>
                    <tbody>
                      {tableRows}
                    </tbody>
                  </table>
                </div>

                {allTransactions.length === 0 && currentStatus?.status !== 'IN_PROGRESS' && (
                  <div className="text-center py-8">
                    <p className="text-sm opacity-70">No transactions found</p>
                  </div>
                )}

                {allTransactions.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-black/5 bg-black/[0.02]">
                    <div className="text-sm muted-copy">
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, allTransactions.length)} of {allTransactions.length} transactions
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-amber-700/30 disabled:opacity-50 transition-colors"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <span className="text-sm px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded hover:bg-amber-700/30 disabled:opacity-50 transition-colors"
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
    </div>
  );
};

export default Transactions;
