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
  setCurrentStake: (stake: {
    amount: number;
    status: StakeStatus | null;
    isInProgress: boolean;
    protocol: 'CCIP' | 'CCTP';
    startTimestamp?: number;
  } | null) => void;
  updateStakeStatus: (status: StakeStatus) => void;
  clearStake: () => void;
  fetchTransactions: (address: string) => Promise<void>;
}

export const useStakingStore = create<StakingStore>()(
  persist(
    (set) => ({
      currentStake: null,
      transactions: [],
      setCurrentStake: (stake) => set({ currentStake: stake }),
      updateStakeStatus: (status) => 
        set((state) => ({
          currentStake: state.currentStake 
            ? { ...state.currentStake, status } 
            : null
        })),
      clearStake: () => set({ currentStake: null }),
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