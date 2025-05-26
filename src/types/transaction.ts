export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'fee';
export type TransactionStatus = 'completed' | 'pending' | 'failed';

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  fee: number;
  currency: string;
  date: string;
  description: string;
  address?: string;
  reference?: string;
  blockExplorer?: string;
}

export interface FilterOptions {
  type: string;
  status: string;
  dateRange: string;
  search: string;
  sortBy: string;
  sortDirection: string;
}

export interface CCTPTransaction {
  sourceTxHash: string;
  messageHash?: string;
  messageBytes?: string;
  attestation?: string;
  destinationTxHash?: string;
  timestamp: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
  amount: number;
  origin: string;
  receiver: string;
}