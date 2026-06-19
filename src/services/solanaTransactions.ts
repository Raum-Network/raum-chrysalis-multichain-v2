import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS } from '../config/contract';
import { CCTPTransaction } from './cctpTransactions';

type SignatureInfo = {
  signature: string;
  slot: number;
  err: unknown | null;
  blockTime: number | null;
};

type JsonRpcResult<T> = { id: number; result?: T; error?: { code: number; message: string } };

type ParsedInstruction = {
  programId?: string;
  data?: string;
};

type ParsedTransaction = {
  slot: number;
  blockTime: number | null;
  transaction: {
    message: {
      accountKeys: Array<string | { pubkey: string }>;
      instructions: ParsedInstruction[];
    };
  };
  meta: {
    err: unknown | null;
    preTokenBalances?: Array<{ owner?: string; mint?: string; uiTokenAmount: { amount: string } }>;
    postTokenBalances?: Array<{ owner?: string; mint?: string; uiTokenAmount: { amount: string } }>;
  } | null;
};

const SOLANA_NETWORK = SUPPORTED_NETWORKS['solana-devnet'];
const SOLANA_RPC_URL = SOLANA_NETWORK.publicRpc;
const CCTP_TOKEN_MESSENGER_PROGRAM = SOLANA_NETWORK.solana?.cctpV2.tokenMessengerMinter || SOLANA_NETWORK.contracts.cctp;
const SOLANA_USDC_MINT = SOLANA_NETWORK.solana?.usdcMint || SOLANA_NETWORK.contracts.usdc;
const DIRECT_MINT_DISCRIMINATOR = Buffer.from([215, 60, 61, 46, 114, 55, 128, 176]);
const SIGNATURE_LIMIT = 100;
const BATCH_SIZE = 10;
const RPC_TIMEOUT_MS = 7000;

const evmAddressToBytes32Hex = (address: string) => {
  const normalized = ethers.getAddress(address);
  return `${'00'.repeat(12)}${normalized.slice(2).toLowerCase()}`;
};

const keyToString = (key: string | { pubkey: string }) =>
  typeof key === 'string' ? key : key.pubkey;

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Solana RPC timeout after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await withTimeout(
    fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
    RPC_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Solana RPC HTTP ${response.status}`);
  }

  const json = await response.json() as JsonRpcResult<T>;
  if (json.error) {
    throw new Error(`Solana RPC error ${json.error.code}: ${json.error.message}`);
  }

  return json.result as T;
}

async function rpcBatch<T>(requests: Array<{ method: string; params: unknown[] }>): Promise<Array<T | null>> {
  if (requests.length === 0) return [];

  const payload = requests.map((request, index) => ({
    jsonrpc: '2.0',
    id: index,
    method: request.method,
    params: request.params,
  }));

  const response = await withTimeout(
    fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    RPC_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Solana RPC batch HTTP ${response.status}`);
  }

  const data = await response.json() as Array<JsonRpcResult<T>>;
  return data
    .sort((a, b) => a.id - b.id)
    .map((entry) => entry.result ?? null);
}

const getUserUsdcDelta = (transaction: ParsedTransaction, owner: string) => {
  const before = transaction.meta?.preTokenBalances?.find((balance) =>
    balance.owner === owner && balance.mint === SOLANA_USDC_MINT
  );
  const after = transaction.meta?.postTokenBalances?.find((balance) =>
    balance.owner === owner && balance.mint === SOLANA_USDC_MINT
  );

  const beforeAmount = BigInt(before?.uiTokenAmount.amount || '0');
  const afterAmount = BigInt(after?.uiTokenAmount.amount || '0');
  const burned = beforeAmount > afterAmount ? beforeAmount - afterAmount : 0n;

  return burned.toString();
};

const hasOurCctpReceiver = (transaction: ParsedTransaction) => {
  if (!SOLANA_NETWORK.contracts.cctpDestinationCaller) return false;
  const expectedReceiver = evmAddressToBytes32Hex(SOLANA_NETWORK.contracts.cctpDestinationCaller);

  return transaction.transaction.message.instructions.some((instruction) => {
    if (instruction.programId !== CCTP_TOKEN_MESSENGER_PROGRAM || !instruction.data) {
      return false;
    }

    try {
      const data = Buffer.from(bs58.decode(instruction.data));
      const isDirectMint = data.subarray(0, DIRECT_MINT_DISCRIMINATOR.length).equals(DIRECT_MINT_DISCRIMINATOR);
      const dataHex = data.toString('hex');

      if (dataHex.includes(expectedReceiver)) return true;
      if (!isDirectMint || data.length < 56) return false;

      return data.subarray(24, 56).toString('hex') === expectedReceiver;
    } catch {
      return false;
    }
  });
};

export async function fetchSolanaCCTPTransactions(ownerAddress: string): Promise<CCTPTransaction[]> {
  if (!ownerAddress || !CCTP_TOKEN_MESSENGER_PROGRAM) return [];

  const signatures = await rpc<SignatureInfo[]>('getSignaturesForAddress', [
    ownerAddress,
    { limit: SIGNATURE_LIMIT, commitment: 'confirmed' },
  ]);

  const transactionsBySignature = new Map<string, ParsedTransaction>();

  for (let index = 0; index < signatures.length; index += BATCH_SIZE) {
    const chunk = signatures.slice(index, index + BATCH_SIZE);
    try {
      const results = await rpcBatch<ParsedTransaction>(
        chunk.map((signature) => ({
          method: 'getTransaction',
          params: [
            signature.signature,
            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
          ],
        }))
      );

      chunk.forEach((signature, resultIndex) => {
        const transaction = results[resultIndex];
        if (transaction) {
          transactionsBySignature.set(signature.signature, transaction);
        }
      });
    } catch (error) {
      console.warn('Skipping Solana transaction batch:', error);
    }
  }

  const matches = signatures
    .map((signatureInfo) => {
      const transaction = transactionsBySignature.get(signatureInfo.signature);
      if (!transaction) return null;

      const accountKeys = transaction.transaction.message.accountKeys.map(keyToString);
      if (!accountKeys.includes(ownerAddress)) return null;
      if (!accountKeys.includes(CCTP_TOKEN_MESSENGER_PROGRAM)) return null;
      if (!hasOurCctpReceiver(transaction)) return null;

      const amount = getUserUsdcDelta(transaction, ownerAddress);
      if (amount === '0') return null;

      return {
        hash: signatureInfo.signature,
        from: ownerAddress,
        to: SOLANA_NETWORK.contracts.cctpDestinationCaller || CCTP_TOKEN_MESSENGER_PROGRAM,
        amount,
        timestamp: (transaction.blockTime || signatureInfo.blockTime || Math.floor(Date.now() / 1000)) * 1000,
        status: transaction.meta?.err ? 'FAILURE' as const : 'IN_PROGRESS' as const,
        sourceNetworkName: SOLANA_NETWORK.name,
        destTransactionHash: undefined,
      };
    })
    .filter((transaction): transaction is CCTPTransaction => transaction !== null);

  return matches.sort((a, b) => b.timestamp - a.timestamp);
}
