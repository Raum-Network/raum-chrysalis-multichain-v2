/**
 * solanaCcip.ts
 *
 * Full CCIP SVM instruction builder for Solana → Ethereum Sepolia.
 * Calls the Chainlink CCIP Router `ccipSend` instruction directly.
 *
 * Account layout reference (19 fixed + 10 per-token remaining_accounts):
 *   https://docs.chain.link/ccip/architecture/svm
 *   https://github.com/smartcontractkit/solana-starter-kit
 *
 * Discriminator: sha256("global:ccipSend")[0..8] = e7732b8b3034c753
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  ComputeBudgetProgram,
  AccountMeta,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createApproveInstruction,
} from '@solana/spl-token';
import { Buffer } from 'buffer';
import { NetworkConfig } from '../config/contract';

// ─── Program addresses ────────────────────────────────────────────────────────

export const CCIP_ROUTER         = new PublicKey('Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C');
export const CCIP_FEE_QUOTER     = new PublicKey('FeeQPGkKDeRV1MgoYfMH6L8o3KeuYjwUZrgn4LRKfjHi');
export const CCIP_RMN_REMOTE     = new PublicKey('RmnXLft1mSEwDgMKu2okYuHkiazxntFFcZFrrcXxYg7');
export const LINK_MINT           = new PublicKey('LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L');
export const WSOL_MINT           = new PublicKey('So11111111111111111111111111111111111111112');
export const SOLANA_USDC_MINT    = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
// USDC burn-mint pool program on Solana devnet
export const USDC_BURNMINT_POOL  = new PublicKey('41FGToCmdaWa1dgZLKFAjvmx6e6AjVTX7SVRibvsMGVB');

// Ethereum Sepolia CCIP chain selector
export const ETH_SEPOLIA_CHAIN_SELECTOR = BigInt('16015286601757825753');

// Instruction discriminator: sha256("global:ccipSend")[0..8]
const CCIP_SEND_DISCRIMINATOR = Buffer.from([0xe7, 0x73, 0x2b, 0x8b, 0x30, 0x34, 0xc7, 0x53]);

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeeToken = 'LINK' | 'wSOL';

export interface CcipSendParams {
  provider: {
    publicKey?: PublicKey | { toString: () => string };
    signTransaction?: <T>(t: T) => Promise<T>;
    signAndSendTransaction?: <T>(t: T) => Promise<{ signature: string }>;
  };
  networkConfig: NetworkConfig;
  /** USDC amount in base units (6 decimals) */
  amount: bigint;
  /** ABI-encoded calldata for destination EVM contract */
  evmCalldata: Uint8Array;
  /** Which token to pay CCIP fees with */
  feeToken: FeeToken;
  /** Gas limit for EVM execution on destination (default 200_000) */
  gasLimit?: bigint;
}

export interface CcipFeeEstimate {
  feeToken: FeeToken;
  /** Fee amount in base units of the fee token */
  amount: bigint;
  /** Human-readable string e.g. "0.012 LINK" */
  display: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const u64LE = (value: bigint): Buffer => {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
};

const u32LE = (value: number): Buffer => {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return buf;
};

function evmAddressToBytes32(address: string): Buffer {
  const clean = address.toLowerCase().replace('0x', '');
  return Buffer.concat([Buffer.alloc(12), Buffer.from(clean, 'hex')]);
}

function pdaSync(seeds: (Buffer | Uint8Array)[], program: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, program)[0];
}

/**
 * Encode EVMExtraArgsV2:
 *   4-byte tag (0x181dcf10) + u128-LE gasLimit (16 bytes) + bool (1 byte)
 */
function encodeEVMExtraArgsV2(gasLimit: bigint, allowOutOfOrder = false): Buffer {
  const tag       = Buffer.from('181dcf10', 'hex');
  const gasLimBuf = Buffer.alloc(16); // u128 LE — high bits = 0
  gasLimBuf.writeBigUInt64LE(gasLimit, 0);
  const oooBuf    = Buffer.from([allowOutOfOrder ? 1 : 0]);
  return Buffer.concat([tag, gasLimBuf, oooBuf]);
}

/**
 * Borsh-encode the SVM2AnyMessage + ccipSend discriminator + chain selector + token_indexes.
 */
function buildCcipSendData(
  destChainSelector: bigint,
  receiver: Buffer,        // 32 bytes
  data: Uint8Array,
  tokenMint: PublicKey,
  tokenAmount: bigint,
  feeTokenMint: PublicKey,
  extraArgs: Buffer,
): Buffer {
  // Vec<u8> = u32LE length + bytes
  const encodeVec = (bytes: Uint8Array) =>
    Buffer.concat([u32LE(bytes.length), Buffer.from(bytes)]);

  // SVMTokenAmount = pubkey(32) + amount(u64 LE = 8)
  const tokenAmountsBuf = Buffer.concat([
    u32LE(1),                   // Vec length = 1
    tokenMint.toBuffer(),
    u64LE(tokenAmount),
  ]);

  const message = Buffer.concat([
    receiver,                          // [u8; 32]
    encodeVec(data),                   // Vec<u8> data
    tokenAmountsBuf,                   // Vec<SVMTokenAmount>
    feeTokenMint.toBuffer(),           // Pubkey fee_token [32]
    encodeVec(extraArgs),              // Vec<u8> extra_args
  ]);

  // token_indexes: Vec<u8> = [0] (first token at index 0 of remaining_accounts)
  const tokenIndexesBuf = Buffer.concat([u32LE(1), Buffer.from([0])]);

  return Buffer.concat([
    CCIP_SEND_DISCRIMINATOR,
    u64LE(destChainSelector),
    message,
    tokenIndexesBuf,
  ]);
}

// ─── PDA derivation ───────────────────────────────────────────────────────────

function deriveAllPDAs(authority: PublicKey, destSelector: bigint, feeTokenMint: PublicKey) {
  const sel = u64LE(destSelector);

  return {
    // Router
    configPDA:           pdaSync([Buffer.from('config')], CCIP_ROUTER),
    destChainStatePDA:   pdaSync([Buffer.from('dest_chain_state'), sel], CCIP_ROUTER),
    noncePDA:            pdaSync([Buffer.from('nonce'), sel, authority.toBuffer()], CCIP_ROUTER),
    feeBillingSignerPDA: pdaSync([Buffer.from('fee_billing_signer')], CCIP_ROUTER),
    tokenPoolsSignerPDA: pdaSync([Buffer.from('token_pools_signer')], CCIP_ROUTER),
    tokenAdminRegistry:  pdaSync([Buffer.from('token_admin_registry'), SOLANA_USDC_MINT.toBuffer()], CCIP_ROUTER),
    // FeeQuoter
    fqConfigPDA:         pdaSync([Buffer.from('config')], CCIP_FEE_QUOTER),
    fqDestChainPDA:      pdaSync([Buffer.from('dest_chain'), sel], CCIP_FEE_QUOTER),
    fqBillingTokenCfg:   pdaSync([Buffer.from('fee_billing_token_config'), feeTokenMint.toBuffer()], CCIP_FEE_QUOTER),
    fqLinkTokenCfg:      pdaSync([Buffer.from('fee_billing_token_config'), LINK_MINT.toBuffer()], CCIP_FEE_QUOTER),
    perChainPerToken:    pdaSync([Buffer.from('per_chain_per_token_config'), sel, SOLANA_USDC_MINT.toBuffer()], CCIP_FEE_QUOTER),
    poolChainConfigPDA:  pdaSync([Buffer.from('ccip_tokenpool_chainconfig'), sel, SOLANA_USDC_MINT.toBuffer()], CCIP_FEE_QUOTER),
    // RMN
    rmnCursesPDA:        pdaSync([Buffer.from('curses')], CCIP_RMN_REMOTE),
    rmnConfigPDA:        pdaSync([Buffer.from('config')], CCIP_RMN_REMOTE),
    // Pool (USDC BurnMint)
    poolConfigPDA:       pdaSync([Buffer.from('ccip_tokenpool_config'), SOLANA_USDC_MINT.toBuffer()], USDC_BURNMINT_POOL),
    poolSignerPDA:       pdaSync([Buffer.from('ccip_tokenpool_signer'), SOLANA_USDC_MINT.toBuffer()], USDC_BURNMINT_POOL),
  };
}

// ─── Fee estimation ───────────────────────────────────────────────────────────

/**
 * Estimate CCIP fee by simulating the Router's getFee view.
 * Returns a fallback estimate if simulation fails.
 */
export async function estimateCcipFee(
  connection: Connection,
  userWallet: PublicKey,
  feeToken: FeeToken,
  amount: bigint,
  evmCalldata: Uint8Array,
  destinationEvmAddress: string,
  gasLimit = 200_000n,
): Promise<CcipFeeEstimate> {
  const feeTokenMint = feeToken === 'LINK' ? LINK_MINT : WSOL_MINT;
  const decimals = feeToken === 'LINK' ? 18 : 9;

  try {
    const pdas        = deriveAllPDAs(userWallet, ETH_SEPOLIA_CHAIN_SELECTOR, feeTokenMint);
    const receiver    = evmAddressToBytes32(destinationEvmAddress);
    const extraArgs   = encodeEVMExtraArgsV2(gasLimit, false);
    const userFeeATA  = getAssociatedTokenAddressSync(feeTokenMint, userWallet, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const feeBillingATA = getAssociatedTokenAddressSync(feeTokenMint, pdas.feeBillingSignerPDA, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    // getFee discriminator: sha256("global:getFee")[0..8]
    const GET_FEE_DISC = Buffer.from([0x98, 0x0f, 0xe9, 0x8e, 0x43, 0x5e, 0x5a, 0x6f]);

    const ixData = Buffer.concat([
      GET_FEE_DISC,
      u64LE(ETH_SEPOLIA_CHAIN_SELECTOR),
      receiver,
      u32LE(evmCalldata.length), Buffer.from(evmCalldata),
      u32LE(1), SOLANA_USDC_MINT.toBuffer(), u64LE(amount),
      feeTokenMint.toBuffer(),
      u32LE(extraArgs.length), extraArgs,
    ]);

    const ix = new TransactionInstruction({
      programId: CCIP_ROUTER,
      keys: [
        { pubkey: pdas.configPDA,           isSigner: false, isWritable: false },
        { pubkey: pdas.destChainStatePDA,   isSigner: false, isWritable: false },
        { pubkey: pdas.noncePDA,            isSigner: false, isWritable: false },
        { pubkey: userWallet,               isSigner: true,  isWritable: false },
        { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID,         isSigner: false, isWritable: false },
        { pubkey: feeTokenMint,             isSigner: false, isWritable: false },
        { pubkey: userFeeATA,               isSigner: false, isWritable: false },
        { pubkey: feeBillingATA,            isSigner: false, isWritable: false },
        { pubkey: pdas.feeBillingSignerPDA, isSigner: false, isWritable: false },
        { pubkey: CCIP_FEE_QUOTER,          isSigner: false, isWritable: false },
        { pubkey: pdas.fqConfigPDA,         isSigner: false, isWritable: false },
        { pubkey: pdas.fqDestChainPDA,      isSigner: false, isWritable: false },
        { pubkey: pdas.fqBillingTokenCfg,   isSigner: false, isWritable: false },
        { pubkey: pdas.fqLinkTokenCfg,      isSigner: false, isWritable: false },
        { pubkey: CCIP_RMN_REMOTE,          isSigner: false, isWritable: false },
        { pubkey: pdas.rmnCursesPDA,        isSigner: false, isWritable: false },
        { pubkey: pdas.rmnConfigPDA,        isSigner: false, isWritable: false },
        { pubkey: pdas.tokenPoolsSignerPDA, isSigner: false, isWritable: false },
      ],
      data: ixData,
    });

    const { blockhash } = await connection.getLatestBlockhash('finalized');
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: userWallet }).add(ix);
    const sim = await connection.simulateTransaction(tx, undefined, true);
    const rd  = sim.value?.returnData?.data;

    if (rd) {
      const raw = Buffer.from(rd[0], rd[1] as BufferEncoding);
      if (raw.length >= 8) {
        const feeAmount = raw.readBigUInt64LE(0);
        return { feeToken, amount: feeAmount, display: `${(Number(feeAmount) / 10 ** decimals).toFixed(6)} ${feeToken}` };
      }
    }
  } catch (e) {
    console.warn('[CCIP] Fee simulation failed, using fallback:', e);
  }

  // Fallback: ~0.01 LINK or ~0.001 wSOL
  const fallback = feeToken === 'LINK' ? 10_000_000_000_000_000n : 1_000_000n;
  return { feeToken, amount: fallback, display: `~${(Number(fallback) / 10 ** decimals).toFixed(6)} ${feeToken} (est.)` };
}

// ─── Main send function ───────────────────────────────────────────────────────

/**
 * Build and submit a CCIP token transfer: Solana devnet → Ethereum Sepolia.
 * Transfers USDC via the Chainlink CCIP Router.
 * Returns the Solana transaction signature.
 */
export async function sendSolanaCcip(params: CcipSendParams): Promise<string> {
  const { provider, networkConfig, amount, evmCalldata, feeToken, gasLimit = 200_000n } = params;

  if (!provider.publicKey) throw new Error('Solana wallet not connected');
  if (!provider.signTransaction && !provider.signAndSendTransaction) {
    throw new Error('Solana wallet does not support transaction signing');
  }

  const owner         = new PublicKey(provider.publicKey.toString());
  const connection    = new Connection(networkConfig.publicRpc, 'confirmed');
  const feeTokenMint  = feeToken === 'LINK' ? LINK_MINT : WSOL_MINT;
  const destEvmAddr   = networkConfig.contracts.destination || networkConfig.contracts.cctpDestinationCaller || '';

  const pdas          = deriveAllPDAs(owner, ETH_SEPOLIA_CHAIN_SELECTOR, feeTokenMint);
  const receiver      = evmAddressToBytes32(destEvmAddr);
  const extraArgs     = encodeEVMExtraArgsV2(gasLimit, false);

  // ATAs
  const userUsdcATA      = getAssociatedTokenAddressSync(SOLANA_USDC_MINT, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const userFeeATA       = getAssociatedTokenAddressSync(feeTokenMint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const feeBillingATA    = getAssociatedTokenAddressSync(feeTokenMint, pdas.feeBillingSignerPDA, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const poolTokenAccount = getAssociatedTokenAddressSync(SOLANA_USDC_MINT, pdas.poolSignerPDA, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  // Estimate fee and add 20% buffer for approval
  const feeEst           = await estimateCcipFee(connection, owner, feeToken, amount, evmCalldata, destEvmAddr, gasLimit);
  const feeApproval      = (feeEst.amount * 120n) / 100n;

  // Build instruction data
  const ixData = buildCcipSendData(
    ETH_SEPOLIA_CHAIN_SELECTOR,
    receiver,
    evmCalldata,
    SOLANA_USDC_MINT,
    amount,
    feeTokenMint,
    extraArgs,
  );

  // Remaining accounts: 10 per-token accounts for USDC
  const remainingAccounts: AccountMeta[] = [
    { pubkey: userUsdcATA,             isSigner: false, isWritable: true  }, // 0 user_token_account
    { pubkey: pdas.perChainPerToken,   isSigner: false, isWritable: false }, // 1 token_billing_config (FeeQuoter)
    { pubkey: pdas.poolChainConfigPDA, isSigner: false, isWritable: false }, // 2 pool_chain_config (FeeQuoter)
    { pubkey: PublicKey.default(),     isSigner: false, isWritable: false }, // 3 lookup_table (placeholder)
    { pubkey: pdas.tokenAdminRegistry, isSigner: false, isWritable: false }, // 4 token_admin_registry
    { pubkey: USDC_BURNMINT_POOL,      isSigner: false, isWritable: false }, // 5 pool_program
    { pubkey: pdas.poolConfigPDA,      isSigner: false, isWritable: false }, // 6 pool_config
    { pubkey: poolTokenAccount,        isSigner: false, isWritable: true  }, // 7 pool_token_account
    { pubkey: pdas.poolSignerPDA,      isSigner: false, isWritable: false }, // 8 pool_signer
    { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false }, // 9 token_program
  ];

  // 19 fixed accounts + remaining per-token accounts
  const ccipSendIx = new TransactionInstruction({
    programId: CCIP_ROUTER,
    keys: [
      { pubkey: pdas.configPDA,           isSigner: false, isWritable: false }, //  1
      { pubkey: pdas.destChainStatePDA,   isSigner: false, isWritable: true  }, //  2
      { pubkey: pdas.noncePDA,            isSigner: false, isWritable: true  }, //  3
      { pubkey: owner,                    isSigner: true,  isWritable: true  }, //  4
      { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false }, //  5
      { pubkey: TOKEN_PROGRAM_ID,         isSigner: false, isWritable: false }, //  6
      { pubkey: feeTokenMint,             isSigner: false, isWritable: false }, //  7
      { pubkey: userFeeATA,               isSigner: false, isWritable: true  }, //  8
      { pubkey: feeBillingATA,            isSigner: false, isWritable: true  }, //  9
      { pubkey: pdas.feeBillingSignerPDA, isSigner: false, isWritable: false }, // 10
      { pubkey: CCIP_FEE_QUOTER,          isSigner: false, isWritable: false }, // 11
      { pubkey: pdas.fqConfigPDA,         isSigner: false, isWritable: false }, // 12
      { pubkey: pdas.fqDestChainPDA,      isSigner: false, isWritable: false }, // 13
      { pubkey: pdas.fqBillingTokenCfg,   isSigner: false, isWritable: false }, // 14
      { pubkey: pdas.fqLinkTokenCfg,      isSigner: false, isWritable: false }, // 15
      { pubkey: CCIP_RMN_REMOTE,          isSigner: false, isWritable: false }, // 16
      { pubkey: pdas.rmnCursesPDA,        isSigner: false, isWritable: false }, // 17
      { pubkey: pdas.rmnConfigPDA,        isSigner: false, isWritable: false }, // 18
      { pubkey: pdas.tokenPoolsSignerPDA, isSigner: false, isWritable: false }, // 19
      ...remainingAccounts,
    ],
    data: ixData,
  });

  // Approve fee billing signer to pull fee token from user's ATA
  const approveIx = createApproveInstruction(
    userFeeATA,
    pdas.feeBillingSignerPDA,
    owner,
    feeApproval,
    [],
    TOKEN_PROGRAM_ID,
  );

  const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })
    .add(computeIx, approveIx, ccipSendIx);

  if (provider.signTransaction) {
    const signed = await provider.signTransaction(tx);
    const sig = await connection.sendRawTransaction((signed as Transaction).serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  }

  const result = await provider.signAndSendTransaction!(tx);
  await connection.confirmTransaction({ signature: result.signature, blockhash, lastValidBlockHeight }, 'confirmed');
  return result.signature;
}

// ─── SPL token balance helper ──────────────────────────────────────────────────

/**
 * Fetch SPL token balance for a given mint + owner via JSON-RPC.
 * Returns 0 if the token account doesn't exist.
 */
export async function getSolanaTokenBalance(
  rpcUrl: string,
  owner: string,
  mint: string,
): Promise<number> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getTokenAccountsByOwner',
        params: [owner, { mint }, { encoding: 'jsonParsed' }],
      }),
    });
    const data = await res.json();
    const accounts: Array<{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } }> =
      data?.result?.value || [];
    return accounts.reduce((sum, acc) => sum + (acc.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
  } catch {
    return 0;
  }
}
