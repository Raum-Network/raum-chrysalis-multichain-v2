/**
 * server/index.js
 * 
 * Express REST API for the XRPL Staking NFT Minter.
 * 
 * Endpoints:
 *   POST /mint-staking-nft   – Mint NFT + create sell offer → returns nfTokenID, offerID
 *   POST /accept-offer       – Accept an offer (custodial mode, staker seed required)
 *   GET  /nft/:nfTokenID     – Decode and return staking metadata from NFT URI
 *   GET  /health             – Health check
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { randomUUID } from "crypto";
import * as xrpl from "xrpl";
import { mintStakingNFT, acceptSellOffer } from "./services/xrplNftService.js";
import { getSolanaStakingNFTs, mintSolanaStakingNFT } from "./services/solanaReceiptNftService.js";
import { executeSepoliaCctp } from "./services/sepoliaExecutor.js";
import { decodeHexUri } from "./services/stakingMetadata.js";
import transactionsHandler from "../api/transactions.js";
import transactionHealthHandler from "../api/transactions/health.js";
import transactionWriteHandler from "../api/transactions/write.js";
import config from "./config/index.js";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const router = express.Router();

// ── Health check ─────────────────────────────────────────────────────────────
router.get("/health", (_req, res) => {
    res.json({ status: "ok", node: config.XRPL_NODE, time: new Date().toISOString() });
});

router.get("/cors-enable", (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// ── Transaction persistence API used by the Vite dev proxy ───────────────────
router.all("/transactions", transactionsHandler);
router.all("/transactions/health", transactionHealthHandler);
router.all("/transactions/write", transactionWriteHandler);

// --- Global sequence reservation queue ---
let sequenceLock = null;

// Helper to reliably compute the deterministic NFTokenID
function buildNFTokenID(flags, transferFee, issuerAddress, taxon, sequence) {
    const flagsHex = flags.toString(16).padStart(4, '0');
    const feeHex = transferFee.toString(16).padStart(4, '0');

    // We decode the classic address into a 20-byte account ID string
    const issuerBytes = Buffer.from(xrpl.decodeAccountID(issuerAddress));
    const issuerHex = issuerBytes.toString('hex').toUpperCase();

    // XRPL scrambles the NFTokenTaxon before placing it in the NFTokenID
    const scramble = Number(((384160001n * BigInt(sequence)) % 4294967296n + 2459n) % 4294967296n);
    const scrambledTaxon = (taxon ^ scramble) >>> 0;

    const taxonHex = scrambledTaxon.toString(16).padStart(8, '0').toUpperCase();
    const seqHex = sequence.toString(16).padStart(8, '0').toUpperCase();

    return (flagsHex + feeHex + issuerHex + taxonHex + seqHex).toUpperCase();
}

// ── GET /reserve-nft-id ───────────────────────────────────────────────────────
/**
 * Resolves the next available sequence number on the Minter Wallet, reserves it,
 * and calculates the precise NFTokenID that will be generated.
 */
router.get("/reserve-nft-id", async (req, res) => {
    const client = new xrpl.Client(config.XRPL_NODE);

    try {
        await client.connect();

        // Use the locked sequence, or fetch strictly from the ledger if lock is free
        let nextSeq = sequenceLock;
        if (nextSeq === null) {
            const accInfo = await client.request({
                command: "account_info",
                account: config.MINTER_ADDRESS,
            });
            const accData = accInfo.result.account_data;
            if (accData.MintedNFTokens) {
                // The exact sequence of the upcoming NFT is FirstNFTokenSequence + MintedNFTokens 
                nextSeq = accData.FirstNFTokenSequence + accData.MintedNFTokens;
            } else {
                // First ever NFT mint for this account uses the account's transaction Sequence
                nextSeq = accData.Sequence;
            }
            sequenceLock = nextSeq; // Apply the lock so concurrent requests wait or increment
        } else {
            nextSeq++; // If another user is staking simultaneously, increment the reservation
            sequenceLock = nextSeq;
        }

        const predictedNFTokenID = buildNFTokenID(
            8, // tfTransferable flag
            config.NFT_TRANSFER_FEE,
            config.MINTER_ADDRESS,
            config.NFT_TAXON,
            nextSeq
        );

        return res.json({
            success: true,
            reservedSequence: nextSeq,
            nfTokenID: predictedNFTokenID
        });

    } catch (err) {
        console.error("[API] Reserve error:", err);
        return res.status(500).json({ success: false, error: err.message });
    } finally {
        await client.disconnect();
    }
});

// ── POST /release-nft-id ──────────────────────────────────────────────────────
router.post("/release-nft-id", (req, res) => {
    const { sequence } = req.body;
    if (sequence !== undefined && sequenceLock === sequence) {
        sequenceLock--;
        console.log(`[API] Released sequence lock: ${sequence}`);
        return res.json({ success: true, message: `Released sequence ${sequence}` });
    }
    return res.json({ success: false, message: "Sequence lock not held by this sequence or already processed" });
});

// ── POST /mint-staking-nft ────────────────────────────────────────────────────
/**
 * Request body:
 * {
 *   "stakerAddress":      "rXXXXXXXXXXX",   // required
 *   "stakedAmount":       "1000",             // required
 *   "stakedToken":        "XRP",              // optional, default "XRP"
 *   "stakingPool":        "MyPool v1",        // required
 *   "stakingPeriodDays":  90,                 // optional, default 0
 *   "apy":                "12.5",             // optional, default "0"
 *   "confirmationTxHash": "ABCD1234...",      // optional
 *   "uriOverride":        "https://...",      // optional: use external metadata URI
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "nfTokenID": "...",
 *   "offerID": "...",          // staker must accept this offer
 *   "mintTxHash": "...",
 *   "offerTxHash": "...",
 *   "metadata": { ... },       // the staking receipt embedded in the NFT
 *   "explorerUrl": "..."       // XRPL testnet explorer link to the NFT
 * }
 */
router.post("/mint-staking-nft", async (req, res) => {
    const {
        stakerAddress,
        stakedAmount,
        stakedToken,
        stakingPool,
        stakingPeriodDays,
        apy,
        confirmationTxHash,
        uriOverride,
        reservedSequence,
        mintedStETH
    } = req.body;

    // ── Validation ───────────────────────────────────────────────────────────────
    if (!stakerAddress || !stakedAmount || !stakingPool) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: stakerAddress, stakedAmount, stakingPool",
        });
    }

    if (!xrpl.isValidAddress(stakerAddress)) {
        return res.status(400).json({
            success: false,
            error: `Invalid stakerAddress: "${stakerAddress}" is not a valid XRPL address.`,
        });
    }

    try {
        console.log(`\n[API] Minting staking NFT for staker: ${stakerAddress}`);

        const result = await mintStakingNFT(
            {
                stakerAddress,
                stakedAmount: String(stakedAmount),
                stakedToken: stakedToken || "XRP",
                stakingPool,
                stakingPeriodDays: Number(stakingPeriodDays) || 0,
                apy: apy ? String(apy) : "0",
                confirmationTxHash: confirmationTxHash || "",
                sequence: reservedSequence, // explicitly pass the reserved sequence
                mintedStETH: mintedStETH || "0"
            },
            uriOverride || null
        );

        const isTestnet = config.XRPL_NODE.includes("altnet") || config.XRPL_NODE.includes("testnet");
        const explorerBase = isTestnet
            ? "https://testnet.xrpl.org"
            : "https://livenet.xrpl.org";

        return res.status(201).json({
            success: true,
            nfTokenID: result.nfTokenID,
            offerID: result.offerID,
            mintTxHash: result.mintTxHash,
            offerTxHash: result.offerTxHash,
            metadata: result.metadata,
            explorerUrl: `${explorerBase}/nft/${result.nfTokenID}`,
            instructions:
                "The NFT has been minted and a free sell offer has been created for the staker. " +
                "The staker must accept the offer using NFTokenAcceptOffer. " +
                "Use the /accept-offer endpoint (custodial) or have them sign client-side.",
        });
    } catch (err) {
        console.error("[API] Mint error:", err.message);

        // If the mint failed, we need to release/decrement the lock if this request held the most recent one
        // in case a genuine error occurred and the mint didn't go through on ledger.
        if (reservedSequence && reservedSequence === sequenceLock) {
            sequenceLock--;
            if (sequenceLock < 0) sequenceLock = null;
        }

        return res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /mint-solana-staking-nft ────────────────────────────────────────────
router.post("/mint-solana-staking-nft", async (req, res) => {
    const {
        stakerAddress,
        stakedAmount,
        stakedToken,
        stakingPool,
        stakingPeriodDays,
        apy,
        confirmationTxHash,
        sourceTxHash,
        mintedStETH
    } = req.body;

    if (!stakerAddress || !stakedAmount || !stakingPool) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: stakerAddress, stakedAmount, stakingPool",
        });
    }

    try {
        const result = await mintSolanaStakingNFT({
            stakerAddress,
            stakedAmount,
            stakedToken: stakedToken || "USDC",
            stakingPool,
            stakingPeriodDays: Number(stakingPeriodDays) || 0,
            apy: apy ? String(apy) : "0",
            confirmationTxHash: confirmationTxHash || "",
            sourceTxHash: sourceTxHash || "",
            mintedStETH: mintedStETH || "0"
        });

        return res.status(201).json({
            success: true,
            ...result,
            instructions: "The Solana staking receipt NFT has been minted directly into the user's associated token account.",
        });
    } catch (err) {
        console.error("[API] Solana mint error:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /execute-sepolia-contract ───────────────────────────────────────────
router.post("/execute-sepolia-contract", async (req, res) => {
    const requestId = req.body?.requestId || randomUUID();
    try {
        console.info("[API] Sepolia execution requested:", requestId);
        const result = await executeSepoliaCctp({ ...(req.body || {}), requestId });
        return res.status(201).json({ success: true, ...result });
    } catch (err) {
        console.error("[API] Sepolia execution error:", requestId, err.message);
        return res.status(500).json({ success: false, requestId, error: err.message });
    }
});

// ── GET /solana-staking-nfts/:owner ──────────────────────────────────────────
router.get("/solana-staking-nfts/:owner", async (req, res) => {
    try {
        const receipts = await getSolanaStakingNFTs(req.params.owner);
        return res.json({ success: true, receipts });
    } catch (err) {
        console.error("[API] Solana NFT list error:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /accept-offer ────────────────────────────────────────────────────────
/**
 * Custodial mode: accept a sell offer on behalf of the staker.
 * Only use this if you hold the staker's seed (custodial wallet setup).
 *
 * Request body:
 * {
 *   "stakerSeed": "sXXXXX",
 *   "offerID": "ABCD1234..."
 * }
 */
router.post("/accept-offer", async (req, res) => {
    const { stakerSeed, offerID } = req.body;

    if (!stakerSeed || !offerID) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: stakerSeed, offerID",
        });
    }

    try {
        const result = await acceptSellOffer(stakerSeed, offerID);
        return res.json({ success: true, ...result });
    } catch (err) {
        console.error("[API] Accept offer error:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /nft/:nfTokenID ───────────────────────────────────────────────────────
/**
 * Fetch an NFT from the ledger by NFTokenID and decode its staking metadata.
 */
router.get("/nft/:nfTokenID", async (req, res) => {
    const { nfTokenID } = req.params;
    const client = new xrpl.Client(config.XRPL_NODE);

    try {
        await client.connect();

        // nft_info is Clio-only; use account_nfts on the minter and find the NFT by ID
        const nftsResponse = await client.request({
            command: "account_nfts",
            account: config.MINTER_ADDRESS,
            ledger_index: "validated"
        });

        const nft = nftsResponse.result?.account_nfts?.find(
            (n) => n.NFTokenID === nfTokenID
        );

        await client.disconnect();

        if (!nft || !nft.URI) {
            return res.status(404).json({ success: false, error: "NFT not found or has no URI." });
        }

        const decoded = decodeHexUri(nft.URI);

        if (!decoded || decoded.type !== 'embedded' || !decoded.data) {
            return res.status(404).json({ success: false, error: "NFT URI could not be decoded." });
        }

        const d = decoded.data;
        const metadata = {
            v: d.v || "1",
            type: d.type || "stake",
            staker: d.staker || d.s || "",
            amount: d.amount || d.a || "0",
            token: d.token || d.t || "XRP",
            pool: d.pool || d.p || "Raum",
            days: d.days || d.d || 0,
            apy: d.apy || d.y || "0",
            stakedAt: d.stakedAt || d.ts || 0,
            txHash: d.txHash || d.h || "",
            id: d.id || "",
            mintedStETH: d.mintedStETH || d.e || "0",
        };

        return res.json({
            success: true,
            nfTokenID,
            uri: nft.URI,
            metadata,
        });
    } catch (err) {
        await client.disconnect().catch(() => { });
        console.error("[API] NFT lookup error:", err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.use(router);
app.use("/api", router);

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
    console.log(`\n🚀 XRPL Staking NFT Minter API running on http://localhost:${config.PORT}`);
    console.log(`   Network : ${config.XRPL_NODE}`);
    console.log(`   Endpoints:`);
    console.log(`     POST /mint-staking-nft`);
    console.log(`     POST /accept-offer`);
    console.log(`     GET  /nft/:nfTokenID`);
    console.log(`     GET  /api/health`);
    console.log(`     GET  /health\n`);
});

export default app;
