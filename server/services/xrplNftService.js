/**
 * server/services/xrplNftService.js
 *
 * Core XRPL NFT minting logic:
 *  1. Connects to XRPL node
 *  2. Mints an NFTokenMint transaction from the minter account
 *  3. Parses the resulting NFTokenID from tx metadata
 *  4. Creates a 0-XRP sell offer directed at the staker's address
 *     (non-custodial: the staker must accept the offer via NFTokenAcceptOffer)
 *
 * Returns: { nfTokenID, offerID, mintTxHash, offerTxHash }
 */

import * as xrpl from "xrpl";
import config from "../config/index.js";
import { buildStakingReceipt, encodeReceiptToHex } from "./stakingMetadata.js";

/**
 * Extract NFTokenID from a successful NFTokenMint transaction metadata.
 * The NFT is added to the AffectedNodes as a "CreatedNode" of type NFTokenPage.
 */
function extractNFTokenID(meta) {
    for (const node of meta.AffectedNodes || []) {
        const created = node.CreatedNode || node.ModifiedNode;
        if (!created) continue;

        const newFields = created.NewFields || created.FinalFields || {};
        const nfts = newFields.NFTokens || [];
        if (nfts.length > 0) {
            // The newly minted token is the one with the highest sequence/ID
            return nfts[nfts.length - 1].NFToken?.NFTokenID || null;
        }
    }

    // Fallback: check all CreatedNode entries
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

/**
 * Extract OfferID from NFTokenCreateOffer metadata.
 */
function extractOfferID(meta) {
    for (const node of meta.AffectedNodes || []) {
        if (node.CreatedNode?.LedgerEntryType === "NFTokenOffer") {
            return node.CreatedNode.LedgerIndex || null;
        }
    }
    return null;
}

/**
 * Mint a staking NFT and create a sell offer for the staker.
 *
 * @param {Object} stakingParams - Same shape as buildStakingReceipt params
 * @param {string} [uriOverride] - Optional: supply your own URI (HTTPS/IPFS)
 *                                  instead of embedding data on-chain
 * @returns {Promise<{
 *   nfTokenID: string,
 *   offerID: string,
 *   mintTxHash: string,
 *   offerTxHash: string,
 *   metadata: Object,
 *   uriRaw: string,
 * }>}
 */
export async function mintStakingNFT(stakingParams, uriOverride = null) {
    const client = new xrpl.Client(config.XRPL_NODE);

    try {
        await client.connect();
        console.log(`[XRPL] Connected to ${config.XRPL_NODE}`);

        const minterWallet = xrpl.Wallet.fromSeed(config.MINTER_SEED);
        console.log(`[XRPL] Minter address: ${minterWallet.address}`);

        // ── 1. Build staking metadata & URI ─────────────────────────────────────
        const receipt = buildStakingReceipt(stakingParams);
        let uriHex;
        let uriRaw;

        if (uriOverride) {
            uriHex = Buffer.from(uriOverride, "utf8").toString("hex").toUpperCase();
            uriRaw = uriOverride;
        } else {
            const encoded = encodeReceiptToHex(receipt);
            uriHex = encoded.hex;
            uriRaw = encoded.raw;

            if (!encoded.fits) {
                console.warn(
                    "[WARN] Staking metadata exceeds 256 bytes. " +
                    "Consider providing a uriOverride pointing to IPFS/HTTPS."
                );
            }
        }

        console.log(`[XRPL] URI raw: ${uriRaw}`);

        const mintTx = {
            TransactionType: "NFTokenMint",
            Account: minterWallet.address,
            URI: uriHex,
            Flags: xrpl.NFTokenMintFlags.tfTransferable, // 8 – NFT can be sold/transferred
            NFTokenTaxon: config.NFT_TAXON,
            TransferFee: config.NFT_TRANSFER_FEE,
        };

        const mintPrepared = await client.autofill(mintTx);
        const mintSigned = minterWallet.sign(mintPrepared);
        console.log("[XRPL] Submitting NFTokenMint...");

        const mintResult = await client.submitAndWait(mintSigned.tx_blob);
        const mintMeta = mintResult.result.meta;

        if (mintMeta.TransactionResult !== "tesSUCCESS") {
            throw new Error(
                `NFTokenMint failed: ${mintMeta.TransactionResult}\n` +
                JSON.stringify(mintResult.result, null, 2)
            );
        }

        const nfTokenID = extractNFTokenID(mintMeta);
        if (!nfTokenID) {
            throw new Error("Could not extract NFTokenID from mint transaction metadata.");
        }

        const mintTxHash = mintResult.result.hash;
        console.log(`[XRPL] Minted! NFTokenID: ${nfTokenID}`);
        console.log(`[XRPL] Mint tx: ${mintTxHash}`);

        // ── 3. NFTokenCreateOffer (0-XRP sell offer to staker) ───────────────────
        //   - Amount "0" = gift (free transfer)
        //   - Destination = stakerAddress (only they can accept)
        const offerTx = {
            TransactionType: "NFTokenCreateOffer",
            Account: minterWallet.address,
            NFTokenID: nfTokenID,
            Amount: "0",                          // 0 drops = free
            Destination: stakingParams.stakerAddress,
            Flags: xrpl.NFTokenCreateOfferFlags.tfSellNFToken, // 1
        };

        const offerPrepared = await client.autofill(offerTx);
        const offerSigned = minterWallet.sign(offerPrepared);
        console.log("[XRPL] Creating sell offer for staker...");

        const offerResult = await client.submitAndWait(offerSigned.tx_blob);
        const offerMeta = offerResult.result.meta;

        if (offerMeta.TransactionResult !== "tesSUCCESS") {
            throw new Error(
                `NFTokenCreateOffer failed: ${offerMeta.TransactionResult}\n` +
                JSON.stringify(offerResult.result, null, 2)
            );
        }

        const offerID = extractOfferID(offerMeta);
        const offerTxHash = offerResult.result.hash;
        console.log(`[XRPL] Sell offer created! OfferID: ${offerID}`);

        return {
            nfTokenID,
            offerID,
            mintTxHash,
            offerTxHash,
            metadata: receipt,
            uriRaw,
        };
    } finally {
        await client.disconnect();
        console.log("[XRPL] Disconnected.");
    }
}

/**
 * Accept a sell offer on behalf of the staker.
 * Use this only in custodial mode where you hold the staker's seed.
 *
 * @param {string} stakerSeed - Staker's XRPL wallet seed
 * @param {string} offerID    - The NFTokenOffer ledger object ID
 * @returns {Promise<{ acceptTxHash: string }>}
 */
export async function acceptSellOffer(stakerSeed, offerID) {
    const client = new xrpl.Client(config.XRPL_NODE);

    try {
        await client.connect();
        const stakerWallet = xrpl.Wallet.fromSeed(stakerSeed);

        const acceptTx = {
            TransactionType: "NFTokenAcceptOffer",
            Account: stakerWallet.address,
            NFTokenSellOffer: offerID,
        };

        const prepared = await client.autofill(acceptTx);
        const signed = stakerWallet.sign(prepared);
        console.log("[XRPL] Accepting sell offer...");

        const result = await client.submitAndWait(signed.tx_blob);
        if (result.result.meta.TransactionResult !== "tesSUCCESS") {
            throw new Error(`NFTokenAcceptOffer failed: ${result.result.meta.TransactionResult}`);
        }

        console.log(`[XRPL] Offer accepted! Tx: ${result.result.hash}`);
        return { acceptTxHash: result.result.hash };
    } finally {
        await client.disconnect();
    }
}


