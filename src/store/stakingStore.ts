import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StakeStatus } from '../lib/stakeManager';

interface StakingStore {
  currentStake: {
    amount: number;
    status: StakeStatus | null;
    isInProgress: boolean;
    protocol: 'CCIP' | 'CCTP';
    startTimestamp?: number;
  } | null;
  setCurrentStake: (stake: {
    amount: number;
    status: StakeStatus | null;
    isInProgress: boolean;
    protocol: 'CCIP' | 'CCTP';
    startTimestamp?: number;
  } | null) => void;
  updateStakeStatus: (status: StakeStatus) => void;
  clearStake: () => void;
}

export const useStakingStore = create<StakingStore>()(
  persist(
    (set) => ({
      currentStake: null,
      setCurrentStake: (stake) => set({ currentStake: stake }),
      updateStakeStatus: (status) => 
        set((state) => ({
          currentStake: state.currentStake 
            ? { ...state.currentStake, status } 
            : null
        })),
      clearStake: () => set({ currentStake: null }),
    }),
    {
      name: 'staking-store',
    }
  )
);