import { BridgeProtocol } from '../config/contract';

export type PersistedTransactionStatus = 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';

export interface PersistedTransaction {
  id: string;
  walletAddress: string;
  protocol: BridgeProtocol;
  messageId: string;
  sourceTxHash: string;
  destinationTxHash?: string;
  sourceNetworkName: string;
  destNetworkName: string;
  sender?: string;
  receiver?: string;
  amount: string;
  assetSymbol: 'USDC' | 'XRP';
  sourceDecimals: number;
  destDecimals: number;
  status: PersistedTransactionStatus;
  attestationStatus?: string;
  createdAt: number;
  updatedAt: number;
}

type TransactionDb = Record<string, PersistedTransaction[]>;

const STORAGE_KEY = 'chrysalis-transactions-v1';

const isBrowser = () => typeof window !== 'undefined';

const normalizeAddress = (address: string) => address.toLowerCase();

const toNumber = (value: unknown, fallback = Date.now()) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const readLocalDb = (): TransactionDb => {
  if (!isBrowser()) return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TransactionDb;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Failed to parse local transaction cache:', error);
    return {};
  }
};

const writeLocalDb = (db: TransactionDb) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (error) {
    console.warn('Failed to persist local transaction cache:', error);
  }
};

const sortByUpdatedAtDesc = (transactions: PersistedTransaction[]) =>
  [...transactions].sort((a, b) => b.updatedAt - a.updatedAt);

const normalizePersistedTransaction = (
  transaction: Partial<PersistedTransaction>
): PersistedTransaction | null => {
  if (!transaction.id || !transaction.walletAddress || !transaction.protocol || !transaction.sourceTxHash) {
    return null;
  }

  const updatedAt = toNumber(transaction.updatedAt);
  const createdAt = toNumber(transaction.createdAt, updatedAt);

  return {
    id: transaction.id,
    walletAddress: normalizeAddress(transaction.walletAddress),
    protocol: transaction.protocol,
    messageId: transaction.messageId || transaction.sourceTxHash,
    sourceTxHash: transaction.sourceTxHash,
    destinationTxHash: transaction.destinationTxHash,
    sourceNetworkName: transaction.sourceNetworkName || 'Unknown Network',
    destNetworkName: transaction.destNetworkName || 'Sepolia',
    sender: transaction.sender,
    receiver: transaction.receiver,
    amount: transaction.amount || '0',
    assetSymbol: transaction.assetSymbol === 'XRP' ? 'XRP' : 'USDC',
    sourceDecimals: toNumber(transaction.sourceDecimals, 6),
    destDecimals: toNumber(transaction.destDecimals, 6),
    status: transaction.status === 'SUCCESS' || transaction.status === 'FAILURE' ? transaction.status : 'IN_PROGRESS',
    attestationStatus: transaction.attestationStatus,
    createdAt,
    updatedAt,
  };
};

const mergeTransactions = (
  base: PersistedTransaction[],
  incoming: PersistedTransaction[]
): PersistedTransaction[] => {
  const map = new Map<string, PersistedTransaction>();

  for (const transaction of [...base, ...incoming]) {
    const existing = map.get(transaction.id);
    if (!existing || transaction.updatedAt >= existing.updatedAt) {
      map.set(transaction.id, transaction);
    }
  }

  return sortByUpdatedAtDesc(Array.from(map.values()));
};

const readLocalTransactions = (walletAddress: string): PersistedTransaction[] => {
  const normalizedAddress = normalizeAddress(walletAddress);
  const db = readLocalDb();
  const transactions = db[normalizedAddress] || [];

  return sortByUpdatedAtDesc(
    transactions
      .map((transaction) => normalizePersistedTransaction(transaction))
      .filter((transaction): transaction is PersistedTransaction => transaction !== null)
  );
};

const upsertLocalTransaction = (transaction: PersistedTransaction) => {
  const normalizedAddress = normalizeAddress(transaction.walletAddress);
  const db = readLocalDb();
  const existing = db[normalizedAddress] || [];
  db[normalizedAddress] = mergeTransactions(existing, [transaction]);
  writeLocalDb(db);
};

const fetchRemoteTransactions = async (walletAddress: string): Promise<PersistedTransaction[]> => {
  const response = await fetch(`/api/transactions?address=${encodeURIComponent(walletAddress)}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch persisted transactions: ${response.status}`);
  }

  const data = await response.json() as { transactions?: Partial<PersistedTransaction>[] };
  const remote = (data.transactions || [])
    .map((transaction) => normalizePersistedTransaction(transaction))
    .filter((transaction): transaction is PersistedTransaction => transaction !== null);

  return sortByUpdatedAtDesc(remote);
};

const pushRemoteTransaction = async (transaction: PersistedTransaction) => {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(transaction),
  });

  if (!response.ok) {
    throw new Error(`Failed to persist transaction remotely: ${response.status}`);
  }
};

export const createPersistedTransactionId = (
  protocol: BridgeProtocol,
  sourceTxHash: string,
  messageId?: string
) => `${protocol}:${sourceTxHash || messageId || Date.now().toString()}`;

export const getPersistedTransactions = async (walletAddress: string): Promise<PersistedTransaction[]> => {
  const local = readLocalTransactions(walletAddress);

  try {
    const remote = await fetchRemoteTransactions(walletAddress);
    const merged = mergeTransactions(local, remote);

    const db = readLocalDb();
    db[normalizeAddress(walletAddress)] = merged;
    writeLocalDb(db);

    return merged;
  } catch (error) {
    console.warn('Using local transaction cache due to remote fetch error:', error);
    return local;
  }
};

export const upsertPersistedTransaction = async (transaction: Partial<PersistedTransaction>) => {
  const normalized = normalizePersistedTransaction(transaction);
  if (!normalized) return;

  upsertLocalTransaction(normalized);

  try {
    await pushRemoteTransaction(normalized);
  } catch (error) {
    console.warn('Remote transaction persistence unavailable; local cache retained:', error);
  }
};
