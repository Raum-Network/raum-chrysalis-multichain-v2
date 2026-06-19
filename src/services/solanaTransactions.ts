import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS } from '../config/contract';
import { CCTPTransaction } from './cctpTransactions';

const SOLANA_NETWORK = SUPPORTED_NETWORKS['solana-devnet'];
const CCTP_TOKEN_MESSENGER_PROGRAM = SOLANA_NETWORK.solana?.cctpV2.tokenMessengerMinter || SOLANA_NETWORK.contracts.cctp;
const SOLANA_USDC_MINT = SOLANA_NETWORK.solana?.usdcMint || SOLANA_NETWORK.contracts.usdc;
const DIRECT_MINT_DISCRIMINATOR = Buffer.from([215, 60, 61, 46, 114, 55, 128, 176]);

const evmAddressToBytes32Hex = (address: string) => {
  const normalized = ethers.getAddress(address);
  return `${'00'.repeat(12)}${normalized.slice(2).toLowerCase()}`;
};

const keyToString = (key: unknown) => {
  if (typeof key === 'string') return key;
  if (key && typeof key === 'object' && 'pubkey' in key) {
    const pubkey = (key as { pubkey?: unknown }).pubkey;
    return pubkey?.toString?.() || '';
  }
  return key?.toString?.() || '';
};

const getAccountKeys = (transaction: ParsedTransactionWithMeta) =>
  transaction.transaction.message.accountKeys.map(keyToString).filter(Boolean);

const hasProgramInstruction = (transaction: ParsedTransactionWithMeta, programId: string) =>
  transaction.transaction.message.instructions.some((instruction) => {
    if ('programId' in instruction) {
      return instruction.programId.toString() === programId;
    }
    return false;
  });

const hasOurCctpReceiver = (transaction: ParsedTransactionWithMeta) => {
  if (!SOLANA_NETWORK.contracts.cctpDestinationCaller) return false;
  const expectedReceiver = evmAddressToBytes32Hex(SOLANA_NETWORK.contracts.cctpDestinationCaller || '');

  return transaction.transaction.message.instructions.some((instruction) => {
    if (!('programId' in instruction) || instruction.programId.toString() !== CCTP_TOKEN_MESSENGER_PROGRAM) {
      return false;
    }
    if (!('data' in instruction) || typeof instruction.data !== 'string') {
      return false;
    }

    try {
      const data = Buffer.from(bs58.decode(instruction.data));
      const isDirectMint = data.subarray(0, DIRECT_MINT_DISCRIMINATOR.length).equals(DIRECT_MINT_DISCRIMINATOR);
      if (!isDirectMint || data.length < 56) return false;

      const receiver = data.subarray(24, 56).toString('hex');
      return receiver === expectedReceiver;
    } catch {
      return false;
    }
  });
};

const getUserUsdcDelta = (transaction: ParsedTransactionWithMeta, owner: string) => {
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

export async function fetchSolanaCCTPTransactions(ownerAddress: string): Promise<CCTPTransaction[]> {
  if (!ownerAddress || !CCTP_TOKEN_MESSENGER_PROGRAM) return [];

  const connection = new Connection(SOLANA_NETWORK.publicRpc, 'confirmed');
  const owner = new PublicKey(ownerAddress);
  const program = new PublicKey(CCTP_TOKEN_MESSENGER_PROGRAM);
  const currentSlot = await connection.getSlot('confirmed');
  const minSlot = Math.max(0, currentSlot - 1000);

  const [walletSignatures, programSignatures] = await Promise.all([
    connection.getSignaturesForAddress(owner, { limit: 1000 }, 'confirmed'),
    connection.getSignaturesForAddress(program, { limit: 1000 }, 'confirmed'),
  ]);

  const signatures = Array.from(
    new Map(
      [...walletSignatures, ...programSignatures]
        .filter((signature) => signature.slot >= minSlot)
        .map((signature) => [signature.signature, signature])
    ).values()
  );

  const transactions = await Promise.all(
    signatures.map(async (signatureInfo) => {
      const transaction = await connection.getParsedTransaction(signatureInfo.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!transaction) return null;

      const accountKeys = getAccountKeys(transaction);
      if (!accountKeys.includes(ownerAddress)) return null;
      if (!hasProgramInstruction(transaction, CCTP_TOKEN_MESSENGER_PROGRAM)) return null;
      if (!hasOurCctpReceiver(transaction)) return null;

      const amount = getUserUsdcDelta(transaction, ownerAddress);
      if (amount === '0') return null;

      return {
        hash: signatureInfo.signature,
        from: ownerAddress,
        to: CCTP_TOKEN_MESSENGER_PROGRAM,
        amount,
        timestamp: (transaction.blockTime || signatureInfo.blockTime || Math.floor(Date.now() / 1000)) * 1000,
        status: transaction.meta?.err ? 'FAILURE' as const : 'IN_PROGRESS' as const,
        sourceNetworkName: SOLANA_NETWORK.name,
        destTransactionHash: undefined,
      };
    })
  );

  return transactions
    .filter((transaction): transaction is CCTPTransaction => transaction !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
}
