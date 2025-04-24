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