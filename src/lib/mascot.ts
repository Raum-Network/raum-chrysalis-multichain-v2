export type MascotState =
  | 'idle'
  | 'mouse-follow'
  | 'terminal-listening'
  | 'thinking'
  | 'answer-ready'
  | 'transaction-start'
  | 'staking-action'
  | 'pending-transaction'
  | 'staking-success'
  | 'error'
  | 'bridge-cross-chain'
  | 'reward-claim';

export type MascotCue = {
  state: Exclude<MascotState, 'mouse-follow'> | 'idle';
  durationMs?: number;
  sticky?: boolean;
};

export const MASCOT_STATE_LABELS: Record<MascotState, string> = {
  idle: 'Idle',
  'mouse-follow': 'Mouse Follow',
  'terminal-listening': 'Terminal Listening',
  thinking: 'Thinking',
  'answer-ready': 'Answer Ready',
  'transaction-start': 'Transaction Start',
  'staking-action': 'Staking Action',
  'pending-transaction': 'Pending Transaction',
  'staking-success': 'Staking Success',
  error: 'Friendly Error',
  'bridge-cross-chain': 'Bridge / Cross-Chain',
  'reward-claim': 'Reward Claim',
};

export const MASCOT_CUE_DURATIONS: Partial<Record<MascotState, number>> = {
  'answer-ready': 2400,
  'transaction-start': 2600,
  'staking-success': 3600,
  error: 2800,
  'reward-claim': 3200,
};
