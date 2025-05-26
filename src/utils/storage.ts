import { CCTPTransaction } from '../types/transaction';

const CCTP_TRANSACTIONS_KEY = 'cctp-transactions';

export const saveTransaction = (transaction: CCTPTransaction) => {
  const transactions = getTransactions();
  transactions.unshift(transaction);
  localStorage.setItem(CCTP_TRANSACTIONS_KEY, JSON.stringify(transactions));
};

export const getTransactions = (): CCTPTransaction[] => {
  const stored = localStorage.getItem(CCTP_TRANSACTIONS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const updateTransaction = (sourceTxHash: string, updates: Partial<CCTPTransaction>) => {
  const transactions = getTransactions();
  const index = transactions.findIndex(tx => tx.sourceTxHash === sourceTxHash);
  if (index !== -1) {
    transactions[index] = { ...transactions[index], ...updates };
    localStorage.setItem(CCTP_TRANSACTIONS_KEY, JSON.stringify(transactions));
  }
};