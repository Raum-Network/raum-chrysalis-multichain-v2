import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
}) {
    if (!config.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is not configured");
    }

    const web3 = new Web3(SEPOLIA_RPC_URL);
    const account = web3.eth.accounts.privateKeyToAccount(config.PRIVATE_KEY);
    web3.eth.accounts.wallet.add(account);

    const normalizedReceiver = normalizeEvmAddress(receiverAddress);
    const contract = new web3.eth.Contract(RECEIVER_ABI, normalizedReceiver);
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

    const tx = contract.methods.receiveUSDC(hookData, messageBytes, attestation);
    const gas = await tx.estimateGas({ from: account.address });
    const gasPrice = await web3.eth.getGasPrice();
    const signedTx = await account.signTransaction({
        from: account.address,
        to: normalizedReceiver,
        data: tx.encodeABI(),
        gas,
        gasPrice,
    });
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    return {
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed?.toString(),
    };
}
