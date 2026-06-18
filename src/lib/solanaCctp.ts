import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';
import { NetworkConfig } from '../config/contract';

type SolanaWalletProvider = {
  publicKey?: PublicKey | { toString: () => string };
  signTransaction?: <T>(transaction: T) => Promise<T>;
  signAndSendTransaction?: <T>(transaction: T) => Promise<{ signature: string }>;
};

const DIRECT_MINT_DISCRIMINATOR = Buffer.from([215, 60, 61, 46, 114, 55, 128, 176]);
const CCTP_FINALITY_THRESHOLD = 1000;
const CCTP_MAX_FEE = 500n;

const TOKEN_MESSENGER_MINTER_PROGRAM = new PublicKey('CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe');
const MESSAGE_TRANSMITTER_PROGRAM = new PublicKey('CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC');
const SOLANA_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

const u64Le = (value: bigint) => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
};

const u32Le = (value: number) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
};

function evmAddressToBytes32(address: string) {
  const normalized = ethers.getAddress(address);
  return Buffer.concat([Buffer.alloc(12), Buffer.from(normalized.slice(2), 'hex')]);
}

function derivePda(seeds: Buffer[], programId: PublicKey) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

export function solanaAddressToEvmAlias(address: string): `0x${string}` {
  const publicKeyBytes = new PublicKey(address).toBytes();
  const digest = ethers.keccak256(publicKeyBytes);
  return `0x${digest.slice(-40)}` as `0x${string}`;
}

export function solanaAddressToBytes32(address: string): `0x${string}` {
  return `0x${Buffer.from(new PublicKey(address).toBytes()).toString('hex')}` as `0x${string}`;
}

export async function burnSolanaUsdcForSepoliaCCTP({
  provider,
  networkConfig,
  amount,
}: {
  provider: SolanaWalletProvider;
  networkConfig: NetworkConfig;
  amount: bigint;
}): Promise<string> {
  if (!provider.publicKey) {
    throw new Error('Solana wallet is not connected');
  }
  if (!provider.signTransaction && !provider.signAndSendTransaction) {
    throw new Error('Solana wallet does not support transaction signing');
  }
  if (!networkConfig.contracts.cctpDestinationCaller) {
    throw new Error('Solana CCTP destination caller is not configured');
  }

  const owner = new PublicKey(provider.publicKey.toString());
  const connection = new Connection(networkConfig.publicRpc, 'confirmed');
  const destinationDomain = networkConfig.destinationDomain ?? 0;
  const receiverBytes32 = evmAddressToBytes32(networkConfig.contracts.cctpDestinationCaller);
  const messageSentEventAccount = Keypair.generate();

  const senderUsdcAccount = getAssociatedTokenAddressSync(
    SOLANA_USDC_MINT,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const senderAuthorityPda = derivePda([Buffer.from('sender_authority')], TOKEN_MESSENGER_MINTER_PROGRAM);
  const denylistPda = derivePda(
    [Buffer.from('denylist_account'), owner.toBuffer()],
    TOKEN_MESSENGER_MINTER_PROGRAM
  );
  const messageTransmitter = derivePda([Buffer.from('message_transmitter')], MESSAGE_TRANSMITTER_PROGRAM);
  const tokenMessenger = derivePda([Buffer.from('token_messenger')], TOKEN_MESSENGER_MINTER_PROGRAM);
  const remoteTokenMessenger = derivePda(
    [Buffer.from('remote_token_messenger'), Buffer.from(destinationDomain.toString())],
    TOKEN_MESSENGER_MINTER_PROGRAM
  );
  const tokenMinter = derivePda([Buffer.from('token_minter')], TOKEN_MESSENGER_MINTER_PROGRAM);
  const localToken = derivePda(
    [Buffer.from('local_token'), SOLANA_USDC_MINT.toBuffer()],
    TOKEN_MESSENGER_MINTER_PROGRAM
  );
  const eventAuthority = derivePda([Buffer.from('__event_authority')], TOKEN_MESSENGER_MINTER_PROGRAM);
  const messageTransmitterEventAuthority = derivePda(
    [Buffer.from('__event_authority')],
    MESSAGE_TRANSMITTER_PROGRAM
  );

  const instructionData = Buffer.concat([
    DIRECT_MINT_DISCRIMINATOR,
    u64Le(amount),
    u32Le(destinationDomain),
    receiverBytes32,
    Buffer.alloc(32),
    u64Le(CCTP_MAX_FEE),
    u32Le(CCTP_FINALITY_THRESHOLD),
  ]);

  const instruction = new TransactionInstruction({
    programId: TOKEN_MESSENGER_MINTER_PROGRAM,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: senderAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: senderUsdcAccount, isSigner: false, isWritable: true },
      { pubkey: denylistPda, isSigner: false, isWritable: false },
      { pubkey: messageTransmitter, isSigner: false, isWritable: true },
      { pubkey: tokenMessenger, isSigner: false, isWritable: false },
      { pubkey: remoteTokenMessenger, isSigner: false, isWritable: false },
      { pubkey: tokenMinter, isSigner: false, isWritable: false },
      { pubkey: localToken, isSigner: false, isWritable: true },
      { pubkey: SOLANA_USDC_MINT, isSigner: false, isWritable: true },
      { pubkey: messageSentEventAccount.publicKey, isSigner: true, isWritable: true },
      { pubkey: MESSAGE_TRANSMITTER_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: messageTransmitterEventAuthority, isSigner: false, isWritable: false },
      { pubkey: MESSAGE_TRANSMITTER_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({
    feePayer: owner,
    blockhash,
    lastValidBlockHeight,
  }).add(instruction);

  transaction.partialSign(messageSentEventAccount);

  if (provider.signTransaction) {
    const signedTransaction = await provider.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return signature;
  }

  const result = await provider.signAndSendTransaction!(transaction);
  await connection.confirmTransaction({ signature: result.signature, blockhash, lastValidBlockHeight }, 'confirmed');
  return result.signature;
}
