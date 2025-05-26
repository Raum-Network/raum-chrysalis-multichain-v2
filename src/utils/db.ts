import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface TransactionDB extends DBSchema {
  'ccip-transactions': {
    key: string;
    value: {
      id: string;
      messageId: string;
      sourceTxHash: string;
      destinationTxHash: string | null;
      timestamp: number;
      status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
      amount: string;
      userAddress: string;
      bridgeProtocol: 'CCIP';
      origin: string;
      receiver: string;
    };
  };
  'cctp-transactions': {
    key: string;
    value: {
      id: string;
      sourceTxHash: string;
      messageHash: string;
      messageBytes: string;
      attestation: string | null;
      destinationTxHash: string | null;
      timestamp: number;
      status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
      amount: string;
      userAddress: string;
      bridgeProtocol: 'CCTP';
      origin: string;
      receiver: string;
    };
  };
}

let db: IDBPDatabase<TransactionDB>;

export const initDB = async () => {
  db = await openDB<TransactionDB>('chrysalis-transactions', 1, {
    upgrade(db) {
      db.createObjectStore('ccip-transactions', { keyPath: 'id' });
      db.createObjectStore('cctp-transactions', { keyPath: 'id' });
    },
  });
};

// CCIP Transaction Methods
export const saveCCIPTransaction = async (transaction: TransactionDB['ccip-transactions']['value']) => {
  await db.add('ccip-transactions', transaction);
};

export const updateCCIPTransaction = async (id: string, updates: Partial<TransactionDB['ccip-transactions']['value']>) => {
  const tx = await db.get('ccip-transactions', id);
  if (tx) {
    await db.put('ccip-transactions', { ...tx, ...updates });
  }
};

export const getCCIPTransactions = async (userAddress: string) => {
  const txs = await db.getAll('ccip-transactions');
  return txs.filter(tx => tx.userAddress.toLowerCase() === userAddress.toLowerCase());
};

// CCTP Transaction Methods
export const saveCCTPTransaction = async (transaction: TransactionDB['cctp-transactions']['value']) => {
  await db.add('cctp-transactions', transaction);
};

export const updateCCTPTransaction = async (id: string, updates: Partial<TransactionDB['cctp-transactions']['value']>) => {
  const tx = await db.get('cctp-transactions', id);
  if (tx) {
    await db.put('cctp-transactions', { ...tx, ...updates });
  }
};

export const getCCTPTransactions = async (userAddress: string) => {
  const txs = await db.getAll('cctp-transactions');
  return txs.filter(tx => tx.userAddress.toLowerCase() === userAddress.toLowerCase());
};