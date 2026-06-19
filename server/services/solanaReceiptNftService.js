import path from "path";
import { fileURLToPath } from "url";
import {
    Connection,
    Keypair,
    PublicKey,
    SYSVAR_RENT_PUBKEY,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    clusterApiUrl,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
    AuthorityType,
    TOKEN_PROGRAM_ID,
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    setAuthority,
} from "@solana/spl-token";
import {
    MPL_TOKEN_METADATA_PROGRAM_ID,
    getCreateMetadataAccountV3InstructionDataSerializer,
    getMetadataAccountDataSerializer,
} from "@metaplex-foundation/mpl-token-metadata";
import config from "../config/index.js";
import { buildStakingReceipt } from "./stakingMetadata.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

function getConnection() {
    return new Connection(config.SOLANA_RPC_URL || clusterApiUrl("devnet"), "confirmed");
}

function parseSecretKey(secretKey) {
    if (!secretKey) {
        throw new Error("SOLANA_MINTER_SECRET_KEY is not configured");
    }

    try {
        const parsed = JSON.parse(secretKey);
        if (Array.isArray(parsed)) {
            return Uint8Array.from(parsed);
        }
    } catch {
        // Fall through to comma-separated parsing.
    }

    const parts = secretKey.split(",").map((part) => Number(part.trim()));
    if (
        parts.length === 64 &&
        parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ) {
        return Uint8Array.from(parts);
    }

    throw new Error("SOLANA_MINTER_SECRET_KEY must be a JSON array or comma-separated secret key bytes");
}

function getMinterKeypair() {
    return Keypair.fromSecretKey(parseSecretKey(config.SOLANA_MINTER_SECRET_KEY));
}

function getExplorerUrl(signatureOrAddress, type = "tx") {
    const clusterParam = config.SOLANA_CLUSTER === "mainnet-beta" ? "" : `?cluster=${config.SOLANA_CLUSTER || "devnet"}`;
    return `https://explorer.solana.com/${type}/${signatureOrAddress}${clusterParam}`;
}

function getMetadataAddress(mint) {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
    )[0];
}

function truncate(value, maxLength) {
    return String(value || "").slice(0, maxLength);
}

function cleanMetadataText(value) {
    return String(value || "").replace(/\0/g, "").trim();
}

function compactReceiptForMetadata(receipt) {
    const expanded = expandReceipt(receipt);
    const compact = {
        v: expanded.v,
        a: truncate(expanded.amount, 16),
        t: truncate(expanded.token, 8),
        e: truncate(expanded.mintedStETH, 16),
        y: truncate(expanded.apy, 8),
        ts: Number(expanded.stakedAt || 0),
        id: truncate(expanded.id, 12),
    };

    if (expanded.txHash) compact.h = truncate(expanded.txHash, 88);
    return compact;
}

function buildMetadataJson(receipt) {
    const expanded = expandReceipt(receipt);
    const amount = truncate(expanded.amount, 16);
    const token = truncate(expanded.token, 8);
    const pool = truncate(expanded.pool, 40);
    const mintedStETH = truncate(expanded.mintedStETH, 16);
    const apy = truncate(expanded.apy, 8);

    return {
        name: `Raum Stake ${amount} ${token}`.slice(0, 32),
        symbol: "RAUMSTK",
        description: `Receipt for staking ${amount} ${token} via ${pool}. Minted ${mintedStETH} stETH at ${apy}% APY.`,
        r: compactReceiptForMetadata(receipt),
    };
}

function buildMetadataUri(receipt) {
    const compactJson = JSON.stringify({ r: compactReceiptForMetadata(receipt) });
    const uri = `data:application/json,${encodeURIComponent(compactJson)}`;

    if (uri.length <= 200) {
        return uri;
    }

    const expanded = expandReceipt(receipt);
    const amount = truncate(expanded.amount, 16);
    const token = truncate(expanded.token, 8);
    const mintedStETH = truncate(expanded.mintedStETH, 16);
    const compact = {
        r: {
            v: "1",
            a: amount,
            t: token,
            e: mintedStETH,
            ts: Number(expanded.stakedAt || 0),
            id: truncate(expanded.id, 12),
        },
    };

    const compactUri = `data:application/json,${encodeURIComponent(JSON.stringify(compact))}`;
    if (compactUri.length <= 200) {
        return compactUri;
    }

    return "data:application/json,%7B%22name%22%3A%22Raum%20Stake%20Receipt%22%2C%22symbol%22%3A%22RAUMSTK%22%2C%22description%22%3A%22Raum%20staking%20receipt.%22%7D";
}

function parseMetadataUri(uri) {
    const cleanedUri = cleanMetadataText(uri);
    if (!cleanedUri.startsWith("data:application/json,")) return null;

    const rawJson = cleanedUri.slice("data:application/json,".length);
    try {
        return JSON.parse(decodeURIComponent(rawJson));
    } catch {
        try {
            return JSON.parse(rawJson);
        } catch {
            return null;
        }
    }
}

async function readReceiptMetadata(connection, mint) {
    const metadataAddress = getMetadataAddress(mint);
    const accountInfo = await connection.getAccountInfo(metadataAddress, "confirmed");
    if (!accountInfo?.data) return null;

    const [metadata] = getMetadataAccountDataSerializer().deserialize(accountInfo.data);
    const metadataName = cleanMetadataText(metadata.name);
    const metadataSymbol = cleanMetadataText(metadata.symbol);
    const metadataUri = cleanMetadataText(metadata.uri);

    if (metadataSymbol !== "RAUMSTK") return null;

    const metadataJson = parseMetadataUri(metadataUri);
    const compactReceipt = metadataJson?.r || metadataJson?.receipt || {};
    const amountFromName = metadataName.match(/^Raum Stake\s+([^\s]+)\s+([A-Z0-9]+)/i);

    return {
        metadataAddress: metadataAddress.toBase58(),
        metadataUri,
        metadataName,
        metadataSymbol,
        receipt: {
            ...compactReceipt,
            a: compactReceipt.a || amountFromName?.[1] || "0",
            t: compactReceipt.t || amountFromName?.[2] || "USDC",
        },
    };
}

async function createReceiptMetadata({ connection, minter, mint, receipt }) {
    const metadataAddress = getMetadataAddress(mint);
    const metadataUri = buildMetadataUri(receipt);
    const metadataName = buildMetadataJson(receipt).name;
    const metadataSymbol = "RAUMSTK";
    const data = getCreateMetadataAccountV3InstructionDataSerializer().serialize({
        data: {
            name: metadataName,
            symbol: metadataSymbol,
            uri: metadataUri,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        },
        isMutable: true,
        collectionDetails: null,
    });

    const instruction = new TransactionInstruction({
        programId: TOKEN_METADATA_PROGRAM_ID,
        keys: [
            { pubkey: metadataAddress, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: minter.publicKey, isSigner: true, isWritable: false },
            { pubkey: minter.publicKey, isSigner: true, isWritable: true },
            { pubkey: minter.publicKey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(data),
    });

    const transaction = new Transaction().add(instruction);
    const metadataTxHash = await sendAndConfirmTransaction(connection, transaction, [minter], {
        commitment: "confirmed",
    });

    return {
        metadataAddress: metadataAddress.toBase58(),
        metadataTxHash,
        metadataUri,
        metadataName,
        metadataSymbol,
    };
}

function expandReceipt(receipt) {
    return {
        v: receipt.v || "1",
        type: "stake",
        staker: receipt.staker || receipt.s || "",
        amount: receipt.amount || receipt.a || "0",
        token: receipt.token || receipt.t || "USDC",
        pool: receipt.pool || receipt.p || "Raum LST Solana CCTP",
        days: receipt.days || receipt.d || 0,
        mintedStETH: receipt.mintedStETH || receipt.e || "0",
        apy: receipt.apy || receipt.y || "0",
        stakedAt: receipt.stakedAt || receipt.ts || 0,
        txHash: receipt.txHash || receipt.h || "",
        id: receipt.id || "",
    };
}

export async function mintSolanaStakingNFT({
    stakerAddress,
    stakedAmount,
    stakedToken = "USDC",
    stakingPool = "Raum LST Solana CCTP",
    stakingPeriodDays = 0,
    apy = "0",
    confirmationTxHash = "",
    mintedStETH = "0",
}) {
    const owner = new PublicKey(stakerAddress);
    const connection = getConnection();
    const minter = getMinterKeypair();

    const receipt = buildStakingReceipt({
        stakerAddress,
        stakedAmount: String(stakedAmount),
        stakedToken,
        stakingPool,
        stakingPeriodDays: Number(stakingPeriodDays) || 0,
        apy: apy ? String(apy) : "0",
        confirmationTxHash,
        mintedStETH: mintedStETH || "0",
    });

    const mint = await createMint(
        connection,
        minter,
        minter.publicKey,
        null,
        0,
        undefined,
        undefined,
        TOKEN_PROGRAM_ID
    );

    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        minter,
        mint,
        owner,
        false,
        "confirmed",
        undefined,
        TOKEN_PROGRAM_ID
    );

    const receiptMetadata = await createReceiptMetadata({
        connection,
        minter,
        mint,
        receipt,
    });

    const mintTxHash = await mintTo(
        connection,
        minter,
        mint,
        tokenAccount.address,
        minter,
        1,
        [],
        undefined,
        TOKEN_PROGRAM_ID
    );

    const revokeMintAuthorityTxHash = await setAuthority(
        connection,
        minter,
        mint,
        minter.publicKey,
        AuthorityType.MintTokens,
        null,
        [],
        undefined,
        TOKEN_PROGRAM_ID
    );

    const now = Date.now();
    const record = {
        id: mint.toBase58(),
        mintAddress: mint.toBase58(),
        tokenAccount: tokenAccount.address.toBase58(),
        owner: owner.toBase58(),
        mintTxHash,
        ...receiptMetadata,
        revokeMintAuthorityTxHash,
        metadata: receipt,
        receipt: expandReceipt(receipt),
        createdAt: now,
        updatedAt: now,
        explorerUrl: getExplorerUrl(mint.toBase58(), "address"),
    };

    return record;
}

export async function getSolanaStakingNFTs(ownerAddress) {
    const owner = new PublicKey(ownerAddress);

    try {
        const connection = getConnection();
        const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_PROGRAM_ID,
        });

        const liveTokens = accounts.value
                .filter((account) => {
                    const info = account.account.data.parsed?.info;
                    return info?.tokenAmount?.decimals === 0 && info?.tokenAmount?.uiAmount === 1;
                })
                .map((account) => ({
                    tokenAccount: account.pubkey.toBase58(),
                    mintAddress: account.account.data.parsed.info.mint,
                }));

        if (liveTokens.length === 0) {
            return [];
        }

        const records = await Promise.all(liveTokens.map(async ({ mintAddress, tokenAccount }) => {
            const mint = new PublicKey(mintAddress);
            const metadata = await readReceiptMetadata(connection, mint);
            if (!metadata) return null;

            const receipt = expandReceipt({
                ...metadata.receipt,
                s: owner.toBase58(),
                id: metadata.receipt.id || metadata.receipt.i || mint.toBase58(),
            });

            const createdAt = receipt.stakedAt ? Number(receipt.stakedAt) * 1000 : Date.now();
            return {
                id: mint.toBase58(),
                mintAddress: mint.toBase58(),
                tokenAccount,
                owner: owner.toBase58(),
                mintTxHash: "",
                metadataAddress: metadata.metadataAddress,
                metadataTxHash: "",
                metadataUri: metadata.metadataUri,
                metadataName: metadata.metadataName,
                metadataSymbol: metadata.metadataSymbol,
                revokeMintAuthorityTxHash: "",
                metadata: metadata.receipt,
                receipt,
                createdAt,
                updatedAt: createdAt,
                explorerUrl: getExplorerUrl(mint.toBase58(), "address"),
            };
        }));

        return records
            .filter(Boolean)
            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    } catch (error) {
        console.error("[Solana NFT] Failed to fetch from Solana:", error.message);
        return [];
    }
}
