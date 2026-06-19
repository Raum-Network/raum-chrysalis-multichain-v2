import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { ethers } from "ethers";
import Web3 from "web3";
import { PublicKey } from "@solana/web3.js";
import config from "../config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECEIVER_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "..", "src", "lib", "abi", "ChrysalisReceiverCCTP.json"), "utf8")
);
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/cea2942c462d447983f9f20783cd2f64";
const abiCoder = new ethers.AbiCoder();

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RECEIPT_TIMEOUT_MS = Number(process.env.SEPOLIA_RECEIPT_TIMEOUT_MS || 180_000);
const GAS_BUFFER_NUMERATOR = 12n;
const GAS_BUFFER_DENOMINATOR = 10n;

function createExecutionLogger(requestId) {
    const startedAt = Date.now();
    return (stage, details = {}) => {
        const elapsedMs = Date.now() - startedAt;
        console.info("[SepoliaExecutor]", JSON.stringify({ requestId, stage, elapsedMs, ...details }));
    };
}

function normalizeEvmAddress(value) {
    if (!value) return ZERO_ADDRESS;
    const trimmed = String(value).trim();
    if (!trimmed) return ZERO_ADDRESS;
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function solanaAddressToBytes32(address) {
    try {
        return `0x${Buffer.from(new PublicKey(address).toBytes()).toString("hex")}`;
    } catch {
        return `0x${"0".repeat(64)}`;
    }
}

async function resolveHookData({
    web3,
    contract,
    receiverAddress,
    amount,
    recipient,
    sourceDomainId,
    isSolanaSource,
    solanaOrigin,
}) {
    const normalizedRecipient = normalizeEvmAddress(recipient);

    if (isSolanaSource) {
        const solanaRecipient = solanaAddressToBytes32(solanaOrigin);
        try {
            const callData = web3.eth.abi.encodeFunctionCall(
                {
                    name: "getHookData",
                    type: "function",
                    inputs: [
                        { type: "uint256", name: "amount" },
                        { type: "address", name: "recipientAlias" },
                        { type: "bytes32", name: "solanaRecipient" },
                    ],
                },
                [String(amount), normalizedRecipient, solanaRecipient]
            );
            const response = await web3.eth.call({ to: receiverAddress, data: callData });
            if (response && response !== "0x") {
                return web3.eth.abi.decodeParameter("bytes", response);
            }
        } catch {
            return abiCoder.encode(
                ["uint256", "address", "bytes32"],
                [BigInt(amount), normalizedRecipient, solanaRecipient]
            );
        }
    }

    try {
        const callData = web3.eth.abi.encodeFunctionCall(
            {
                name: "getHookData",
                type: "function",
                inputs: [
                    { type: "uint256", name: "amount" },
                    { type: "address", name: "recipient" },
                    { type: "uint32", name: "sourceDomain" },
                ],
            },
            [String(amount), normalizedRecipient, String(sourceDomainId || 0)]
        );
        const response = await web3.eth.call({ to: receiverAddress, data: callData });
        if (response && response !== "0x") {
            return web3.eth.abi.decodeParameter("bytes", response);
        }
    } catch {
        // Try legacy receiver signature below.
    }

    try {
        return await contract.methods.getHookData(amount, normalizedRecipient).call();
    } catch {
        return sourceDomainId > 0
            ? abiCoder.encode(["uint256", "address", "uint32"], [BigInt(amount), normalizedRecipient, sourceDomainId])
            : abiCoder.encode(["uint256", "address"], [BigInt(amount), normalizedRecipient]);
    }
}

export async function executeSepoliaCctp({
    messageBytes,
    attestation,
    amount,
    recipient,
    receiverAddress,
    sourceDomainId = 0,
    isSolanaSource = false,
    solanaOrigin = "",
    requestId = randomUUID(),
}) {
    const log = createExecutionLogger(requestId);

    if (!config.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is not configured");
    }

    log("initializing", {
        receiverAddress,
        amount: String(amount),
        sourceDomainId,
        isSolanaSource,
    });

    const web3 = new Web3(SEPOLIA_RPC_URL);
    const account = web3.eth.accounts.privateKeyToAccount(config.PRIVATE_KEY);
    web3.eth.accounts.wallet.add(account);

    const normalizedReceiver = normalizeEvmAddress(receiverAddress);
    const contract = new web3.eth.Contract(RECEIVER_ABI, normalizedReceiver);
    log("resolving-hook-data", { receiverAddress: normalizedReceiver });
    const hookData = await resolveHookData({
        web3,
        contract,
        receiverAddress: normalizedReceiver,
        amount,
        recipient,
        sourceDomainId,
        isSolanaSource,
        solanaOrigin,
    });
    log("hook-data-ready", { hookDataBytes: Math.max(0, (hookData.length - 2) / 2) });

    const tx = contract.methods.receiveUSDC(hookData, messageBytes, attestation);
    log("estimating-gas", { from: account.address });
    const estimatedGas = BigInt(await tx.estimateGas({ from: account.address }));
    const gas = ((estimatedGas * GAS_BUFFER_NUMERATOR) / GAS_BUFFER_DENOMINATOR).toString();
    const gasPrice = await web3.eth.getGasPrice();
    log("gas-ready", { estimatedGas: estimatedGas.toString(), gas, gasPrice: gasPrice.toString() });

    const signedTx = await account.signTransaction({
        from: account.address,
        to: normalizedReceiver,
        data: tx.encodeABI(),
        gas,
        gasPrice,
    });
    log("broadcasting-transaction");

    let timeoutId;
    const receipt = await new Promise((resolve, reject) => {
        let transactionHash = "";
        timeoutId = setTimeout(() => {
            const message = transactionHash
                ? `Timed out waiting for Sepolia receipt after ${RECEIPT_TIMEOUT_MS / 1000}s. Transaction hash: ${transactionHash}`
                : `Timed out broadcasting Sepolia transaction after ${RECEIPT_TIMEOUT_MS / 1000}s.`;
            log("timeout", { transactionHash: transactionHash || null });
            reject(new Error(message));
        }, RECEIPT_TIMEOUT_MS);

        web3.eth
            .sendSignedTransaction(signedTx.rawTransaction)
            .on("transactionHash", (hash) => {
                transactionHash = hash;
                log("transaction-hash", {
                    transactionHash: hash,
                    explorerUrl: `https://sepolia.etherscan.io/tx/${hash}`,
                });
                log("waiting-for-receipt", { transactionHash: hash });
            })
            .on("receipt", (confirmedReceipt) => {
                clearTimeout(timeoutId);
                log("receipt-confirmed", {
                    transactionHash: confirmedReceipt.transactionHash,
                    blockNumber: confirmedReceipt.blockNumber?.toString(),
                    gasUsed: confirmedReceipt.gasUsed?.toString(),
                    status: confirmedReceipt.status?.toString(),
                });
                resolve(confirmedReceipt);
            })
            .on("error", (error) => {
                clearTimeout(timeoutId);
                log("transaction-error", {
                    transactionHash: transactionHash || null,
                    error: error?.message || String(error),
                });
                reject(error);
            });
    }).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    });

    return {
        requestId,
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber?.toString(),
    };
}
