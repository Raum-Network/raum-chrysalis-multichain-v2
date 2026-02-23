/**
 * stakingMetadata.js
 * 
 * Builds and encodes staking receipt data for embedding
 * in an XRPL NFT URI field.
 *
 * The URI field on XRPL must be hex-encoded and ≤ 512 hex chars (256 bytes).
 * For payloads fitting in 256 bytes we embed directly.
 * Otherwise, callers should store data off-chain and pass an HTTPS/IPFS URI.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Build a staking receipt object.
 * @param {Object} params
 * @param {string} params.stakerAddress       - Recipient XRPL address
 * @param {string} params.stakedAmount        - Amount staked (as string to preserve precision)
 * @param {string} params.stakedToken         - Token symbol, e.g. "XRP", "USD"
 * @param {string} params.stakingPool         - Pool / protocol name
 * @param {number} [params.stakingPeriodDays] - Lock period in days
 * @param {string} [params.apy]               - APY percentage at stake time e.g. "12.5"
 * @param {string} [params.confirmationTxHash] - On-chain tx hash that triggered the mint
 * @param {number} [params.stakedAt]          - Unix timestamp (default: now)
 * @returns {Object} Staking receipt object
 */
export function buildStakingReceipt({
    stakerAddress,
    stakedAmount,
    stakedToken = "XRP",
    stakingPool,
    stakingPeriodDays = 0,
    apy = "0",
    confirmationTxHash = "",
    stakedAt,
    mintedStETH = "0"
}) {
    const now = Math.floor(Date.now() / 1000);
    const ts = stakedAt || now;
    const expires =
        stakingPeriodDays > 0 ? ts + stakingPeriodDays * 86400 : null;

    return {
        v: "1",               // schema version – bump if you add required fields
        s: stakerAddress,
        a: stakedAmount,
        t: stakedToken,
        p: stakingPool === "Raum LST Axelar ITS" ? "Raum" : stakingPool, // Shrink string
        d: stakingPeriodDays,
        e: mintedStETH, // Tracks stETH minted on Sepolia
        y: apy,
        ts,
        // Shorten the id hash significantly since UUID dashes removed is still 32 chars long total, we just use 8
        id: uuidv4().replace(/-/g, "").slice(0, 8),
    };
}

/**
 * Encode a staking receipt as a hex string suitable for the XRPL URI field.
 * XRPL requires the URI field to be an uppercase hex string.
 * 
 * If the JSON fits within 256 bytes  → embeds as  data:application/json,{...}
 * If it doesn't fit                  → caller should supply a real HTTPS URI
 *                                      (pass uriOverride to mintNFT instead)
 * 
 * @param {Object} receipt - Output of buildStakingReceipt()
 * @returns {{ hex: string, raw: string, fits: boolean }}
 */
export function encodeReceiptToHex(receipt) {
    const json = JSON.stringify(receipt);
    const dataUri = `data:application/json,${json}`;
    const fits = Buffer.byteLength(dataUri, "utf8") <= 256;

    // Compact JSON if we're over the limit
    const finalUri = fits
        ? dataUri
        : `data:application/json,${JSON.stringify(receipt)}`; // already compact

    const hex = Buffer.from(finalUri, "utf8").toString("hex").toUpperCase();

    return { hex, raw: finalUri, fits };
}

/**
 * Decode a hex URI back into a staking receipt object.
 * @param {string} hexUri - The hex-encoded URI from the NFT
 * @returns {Object|null}
 */
export function decodeHexUri(hexUri) {
    try {
        const raw = Buffer.from(hexUri, "hex").toString("utf8");
        if (raw.startsWith("data:application/json,")) {
            const json = raw.slice("data:application/json,".length);
            return { type: "embedded", data: JSON.parse(json), raw };
        }
        // External URI (HTTPS / IPFS)
        return { type: "external", url: raw };
    } catch {
        return null;
    }
}


