import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StakeStatus } from '../lib/stakeManager';
import { getCCIPTransactions } from '../lib/TransactionCall';
import { SUPPORTED_NETWORKS } from '../config/contract';

interface Transaction {
  destTransactionHash:string;
  destDecimals: number;
  sourceDecimals: number;
  sourceNetworkName: string;
  destNetworkName: string;
  blockTimestamp: any;
  state: number;
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
  sourceTxHash?: string;
  destinationTxHash?: string;
  bridgingMessageId?: string;
}

interface StakingStore {
  currentStake: {
    amount: number;
    status: StakeStatus | null;
    isInProgress: boolean;
    protocol: 'CCIP' | 'CCTP';
    startTimestamp?: number;
    sourceDecimals?: number;
    destDecimals?: number;
    sourceNetworkName?: string;
    destNetworkName?: string;
  } | null;
  transactions: Transaction[];
  failedTransactions: StakeStatus[];
  setCurrentStake: (stake: {
    amount: number;
    status: StakeStatus | null;
    isInProgress: boolean;
    protocol: 'CCIP' | 'CCTP';
    startTimestamp?: number;
    sourceDecimals?: number;
    destDecimals?: number;
    sourceNetworkName?: string;
    destNetworkName?: string;
  } | null) => void;
  updateStakeStatus: (status: StakeStatus) => void;
  clearStake: () => void;
  addFailedTransaction: (status: StakeStatus) => void;
  fetchTransactions: (address: string) => Promise<void>;
  reset: () => void;
}

const getNetworkDecimals = (chainName: string): number => {
  const networkKey = Object.keys(SUPPORTED_NETWORKS).find(key => 
    SUPPORTED_NETWORKS[key as keyof typeof SUPPORTED_NETWORKS].ccipNames.sourceName.toLowerCase() === chainName.toLowerCase() ||
    SUPPORTED_NETWORKS[key as keyof typeof SUPPORTED_NETWORKS].ccipNames.destName.toLowerCase() === chainName.toLowerCase()
  );
  
  if (networkKey) {
    return SUPPORTED_NETWORKS[networkKey as keyof typeof SUPPORTED_NETWORKS].contracts.decimal || 6;
  }
  return 6; // Default to 6 decimals if network not found
};

const getNetworkName = (chainName: string): string => {
  
  
  const networkKey = Object.keys(SUPPORTED_NETWORKS).find(key => {
    const sourceName = SUPPORTED_NETWORKS[key as keyof typeof SUPPORTED_NETWORKS].ccipNames.sourceName.toLowerCase();
    const destName = SUPPORTED_NETWORKS[key as keyof typeof SUPPORTED_NETWORKS].ccipNames.destName.toLowerCase();
    const inputName = chainName.toLowerCase();
    
    
    return sourceName === inputName || destName === inputName;
  });
  
  
  
  if (networkKey) {
    const networkName = SUPPORTED_NETWORKS[networkKey as keyof typeof SUPPORTED_NETWORKS].name;
   
    return networkName;
  }
  
 
  return 'Unknown Network';
};

const initialState = {
  currentStake: null,
  transactions: [],
  failedTransactions: [],
};

export const useStakingStore = create<StakingStore>()(
  persist(
    (set) => ({
      ...initialState,
      setCurrentStake: (stake) => {
        if (stake && stake.status) {
          const sourceNetworkName = getNetworkName(stake.status.sourceNetworkName || 'Arbitrum Sepolia');
          const destNetworkName = getNetworkName(stake.status.destNetworkName || 'Sepolia');
          const sourceDecimals = getNetworkDecimals(sourceNetworkName);
          const destDecimals = getNetworkDecimals(destNetworkName);

          set({
            currentStake: {
              ...stake,
              sourceNetworkName,
              destNetworkName,
              sourceDecimals,
              destDecimals
            }
          });
        } else {
          set({ currentStake: stake });
        }
      },
      updateStakeStatus: (status) => 
        set((state) => {
          if (status.status === 'FAILURE') {
            return {
              currentStake: null,
              failedTransactions: [...state.failedTransactions, status]
            };
          }

          if (state.currentStake) {
            const sourceNetworkName = getNetworkName(status.sourceNetworkName || 'Arbitrum Sepolia');
            const destNetworkName = getNetworkName(status.destNetworkName || 'Sepolia');
            const sourceDecimals = getNetworkDecimals(sourceNetworkName);
            const destDecimals = getNetworkDecimals(destNetworkName);

            return {
              currentStake: {
                ...state.currentStake,
                status: {
                  ...status,
                  sourceNetworkName,
                  destNetworkName,
                  sourceDecimals,
                  destDecimals
                }
              }
            };
          }
          return { currentStake: null };
        }),
      clearStake: () => set({ currentStake: null }),
      addFailedTransaction: (status) => 
        set((state) => ({
          failedTransactions: [...state.failedTransactions, status]
        })),
      fetchTransactions: async (address: string) => {
        try {
          const transactions = await getCCIPTransactions(address);
          
          
          const processedTransactions = transactions?.map((tx: Transaction) => (
            
            {
              ...tx,
              sourceNetworkName: getNetworkName(tx.sourceNetworkName || 'Arbitrum Sepolia'),
              destNetworkName: 'Sepolia',
              sourceDecimals: getNetworkDecimals(tx.sourceNetworkName || 'Arbitrum Sepolia'),
              destDecimals: getNetworkDecimals('Sepolia')
            }
          )) || [];
          
          
          set({ transactions: processedTransactions });
        } catch (error) {
          console.error('Error fetching transactions:', error);
          set({ transactions: [] });
        }
      },
      reset: () => {
        set(initialState);
        window.localStorage.removeItem('staking-store');
      },
    }),
    {
      name: 'staking-store',
    }
  )
);