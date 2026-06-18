/**
 * xrplMinter.ts
 *
 * Client-side XRPL NFT minting logic. Server equivalent lives under server/.
 * Connects to XRPL, mints an NFTokenMint tx from the minter account,
 * creates a 0-XRP sell offer directed at the staker, and returns the result.
 */
import * as xrpl from 'xrpl';

// ── Config (mirrors server/config/index.js) ──────────────────────────────────
const XRPL_NODE = import.meta.env.VITE_XRPL_NODE || "wss://s.altnet.rippletest.net:51233";
const MINTER_SEED = import.meta.env.VITE_MINTER_SEED || "";
const MINTER_ADDRESS = import.meta.env.VITE_MINTER_ADDRESS || "";
const NFT_TAXON = parseInt(import.meta.env.VITE_NFT_TAXON || "0", 10);
const NFT_TRANSFER_FEE = parseInt(import.meta.env.VITE_NFT_TRANSFER_FEE || "0", 10);

type XrplNftFields = {
    NFTokens?: Array<{ NFToken?: { NFTokenID?: string } }>;
};

type XrplAffectedNode = {
    CreatedNode?: {
        LedgerEntryType?: string;
        LedgerIndex?: string;
        NewFields?: XrplNftFields;
        FinalFields?: XrplNftFields;
    };
    ModifiedNode?: {
        NewFields?: XrplNftFields;
        FinalFields?: XrplNftFields;
    };
};

type XrplMeta = {
    AffectedNodes?: XrplAffectedNode[];
    TransactionResult?: string;
};

type XrplAccountData = {
    MintedNFTokens?: number;
    FirstNFTokenSequence?: number;
    Sequence: number;
};

// ── Staking receipt builder (mirrors stakingMetadata.js) ─────────────────────
function buildStakingReceipt(params: {
    stakerAddress: string;
    stakedAmount: string;
    stakedToken?: string;
    stakingPool: string;
    stakingPeriodDays?: number;
    apy?: string;
    confirmationTxHash?: string;
    stakedAt?: number;
    mintedStETH?: string;
}) {
    const now = Math.floor(Date.now() / 1000);
    const ts = params.stakedAt || now;
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

    return {
        v: "1",
        s: params.stakerAddress,
        a: params.stakedAmount,
        t: params.stakedToken || "XRP",
        p: params.stakingPool === "Raum LST Axelar ITS" ? "Raum" : params.stakingPool,
        d: params.stakingPeriodDays || 0,
        e: params.mintedStETH || "0",
        y: params.apy || "0",
        ts,
        h: params.confirmationTxHash || "",
        id,
    };
}

function encodeReceiptToHex(receipt: Record<string, unknown>) {
    const json = JSON.stringify(receipt);
    const dataUri = `data:application/json,${json}`;
    const hex = Array.from(new TextEncoder().encode(dataUri))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    const fits = new TextEncoder().encode(dataUri).length <= 256;
    return { hex, raw: dataUri, fits };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractNFTokenID(meta: XrplMeta): string | null {
    for (const node of meta.AffectedNodes || []) {
        const created = node.CreatedNode || node.ModifiedNode;
        if (!created) continue;
        const newFields = created.NewFields || created.FinalFields || {};
        const nfts = newFields.NFTokens || [];
        if (nfts.length > 0) {
            return nfts[nfts.length - 1].NFToken?.NFTokenID || null;
        }
    }
    for (const node of meta.AffectedNodes || []) {
        if (node.CreatedNode?.LedgerEntryType === "NFTokenPage") {
            const nfts = node.CreatedNode.NewFields?.NFTokens || [];
            if (nfts.length > 0) {
                return nfts[nfts.length - 1].NFToken?.NFTokenID || null;
            }
        }
    }
    return null;
}

function extractOfferID(meta: XrplMeta): string | null {
    for (const node of meta.AffectedNodes || []) {
        if (node.CreatedNode?.LedgerEntryType === "NFTokenOffer") {
            return node.CreatedNode.LedgerIndex || null;
        }
    }
    return null;
}

function buildNFTokenID(
    flags: number,
    transferFee: number,
    issuerAddress: string,
    taxon: number,
    sequence: number
): string {
    const flagsHex = flags.toString(16).padStart(4, '0');
    const feeHex = transferFee.toString(16).padStart(4, '0');
    const issuerBytes = xrpl.decodeAccountID(issuerAddress);
    const issuerHex = Array.from(issuerBytes)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    const scramble = Number(((384160001n * BigInt(sequence)) % 4294967296n + 2459n) % 4294967296n);
    const scrambledTaxon = (taxon ^ scramble) >>> 0;
    const taxonHex = scrambledTaxon.toString(16).padStart(8, '0').toUpperCase();
    const seqHex = sequence.toString(16).padStart(8, '0').toUpperCase();
    return (flagsHex + feeHex + issuerHex + taxonHex + seqHex).toUpperCase();
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Reserve a deterministic NFTokenID by computing the next sequence from the ledger.
 */
export async function reserveNftId(): Promise<{ reservedSequence: number; nfTokenID: string }> {
    const client = new xrpl.Client(XRPL_NODE);
    try {
        await client.connect();
        const accInfo = await client.request({
            command: "account_info",
            account: MINTER_ADDRESS,
        });
        const accData = accInfo.result.account_data as XrplAccountData;
        let nextSeq: number;
        if (accData.MintedNFTokens) {
            nextSeq = accData.FirstNFTokenSequence + accData.MintedNFTokens;
        } else {
            nextSeq = accData.Sequence;
        }
        const nfTokenID = buildNFTokenID(8, NFT_TRANSFER_FEE, MINTER_ADDRESS, NFT_TAXON, nextSeq);
        return { reservedSequence: nextSeq, nfTokenID };
    } finally {
        await client.disconnect();
    }
}

/**
 * Mint a staking NFT and create a free sell offer directed at the staker.
 */
export async function mintStakingNFT(params: {
    stakerAddress: string;
    stakedAmount: string;
    stakedToken?: string;
    stakingPool: string;
    stakingPeriodDays?: number;
    apy?: string;
    confirmationTxHash?: string;
    mintedStETH?: string;
}): Promise<{
    nfTokenID: string;
    offerID: string | null;
    mintTxHash: string;
    offerTxHash: string;
    metadata: Record<string, unknown>;
}> {
    if (!MINTER_SEED) throw new Error("VITE_MINTER_SEED is not configured");

    const client = new xrpl.Client(XRPL_NODE);
    try {
        await client.connect();
        console.log(`[xrplMinter] Connected to ${XRPL_NODE}`);

        const minterWallet = xrpl.Wallet.fromSeed(MINTER_SEED);

        // 1. Build metadata & URI
        const receipt = buildStakingReceipt(params);
        const encoded = encodeReceiptToHex(receipt);
        if (!encoded.fits) {
            console.warn("[xrplMinter] Metadata exceeds 256 bytes.");
        }

        // 2. NFTokenMint
        const mintTx = {
            TransactionType: "NFTokenMint",
            Account: minterWallet.address,
            URI: encoded.hex,
            Flags: 8, // tfTransferable
            NFTokenTaxon: NFT_TAXON,
            TransferFee: NFT_TRANSFER_FEE,
        } as Parameters<typeof client.autofill>[0];

        const mintPrepared = await client.autofill(mintTx);
        const mintSigned = minterWallet.sign(mintPrepared);
        console.log("[xrplMinter] Submitting NFTokenMint...");

        const mintResult = await client.submitAndWait(mintSigned.tx_blob);
        const mintMeta = mintResult.result.meta as XrplMeta;

        if (mintMeta.TransactionResult !== "tesSUCCESS") {
            throw new Error(`NFTokenMint failed: ${mintMeta.TransactionResult}`);
        }

        const nfTokenID = extractNFTokenID(mintMeta);
        if (!nfTokenID) throw new Error("Could not extract NFTokenID from mint tx metadata.");

        const mintTxHash = mintResult.result.hash;
        console.log(`[xrplMinter] Minted! NFTokenID: ${nfTokenID}`);

        // 3. Create sell offer (free) directed at the staker
        const offerTx = {
            TransactionType: "NFTokenCreateOffer",
            Account: minterWallet.address,
            NFTokenID: nfTokenID,
            Amount: "0",
            Destination: params.stakerAddress,
            Flags: 1, // tfSellNFToken
        } as Parameters<typeof client.autofill>[0];

        const offerPrepared = await client.autofill(offerTx);
        const offerSigned = minterWallet.sign(offerPrepared);
        console.log("[xrplMinter] Creating sell offer for staker...");

        const offerResult = await client.submitAndWait(offerSigned.tx_blob);
        const offerMeta = offerResult.result.meta as XrplMeta;

        if (offerMeta.TransactionResult !== "tesSUCCESS") {
            throw new Error(`NFTokenCreateOffer failed: ${offerMeta.TransactionResult}`);
        }

        const offerID = extractOfferID(offerMeta);
        const offerTxHash = offerResult.result.hash;
        console.log(`[xrplMinter] Sell offer created! OfferID: ${offerID}`);

        return { nfTokenID, offerID, mintTxHash, offerTxHash, metadata: receipt };
    } finally {
        await client.disconnect();
        console.log("[xrplMinter] Disconnected.");
    }
}
