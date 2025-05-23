import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StakeStatus } from '../lib/stakeManager';
import { getCCIPTransactions } from '../lib/TransactionCall';

interface Transaction {
  messageId: string;
  status: string;
  sourceChainSelector: string;
  sourceChainName: string;
  destinationChainSelector: string;
  destinationChainName: string;
  sender: string;
  receiver: string;
  tokenAmounts: Array<{
    amount: string;
    token: {
      address: string;
      symbol: string;
      decimals: number;
    }
  }>;
  sourceTimestamp: string;
  destinationTimestamp: string | null;
}

interface StakingStore {
  currentStake: {
    amount: number;
    status: StakeStatus | null;
    isInProgress: boolean;
    protocol: 'CCIP' | 'CCTP';
    startTimestamp?: number;
  } | null;
  transactions: Transaction[];
  failedTransactions: StakeStatus[];
  setCurrentStake: (stake: {
    amount: number;
    status: StakeStatus | null;
    isInProgress: boolean;
    protocol: 'CCIP' | 'CCTP';
    startTimestamp?: number;
  } | null) => void;
  updateStakeStatus: (status: StakeStatus) => void;
  clearStake: () => void;
  addFailedTransaction: (status: StakeStatus) => void;
  fetchTransactions: (address: string) => Promise<void>;
}

export const useStakingStore = create<StakingStore>()(
  persist(
    (set) => ({
      currentStake: null,
      transactions: [],
      failedTransactions: [],
      setCurrentStake: (stake) => set({ currentStake: stake }),
      updateStakeStatus: (status) => 
        set((state) => {
          if (status.status === 'FAILURE') {
            return {
              currentStake: null,
              failedTransactions: [...state.failedTransactions, status]
            };
          }
          return {
            currentStake: state.currentStake 
              ? { ...state.currentStake, status } 
              : null
          };
        }),
      clearStake: () => set({ currentStake: null }),
      addFailedTransaction: (status) => 
        set((state) => ({
          failedTransactions: [...state.failedTransactions, status]
        })),
      fetchTransactions: async (address: string) => {
        try {
          const transactions = await getCCIPTransactions(address);
          set({ transactions: transactions.data || [] });
        } catch (error) {
          console.error('Error fetching transactions:', error);
          set({ transactions: [] });
        }
      },
    }),
    {
      name: 'staking-store',
    }
  )
);