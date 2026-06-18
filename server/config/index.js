import dotenv from "dotenv";
dotenv.config();

export default {
    XRPL_NODE: process.env.XRPL_NODE || "wss://s.altnet.rippletest.net:51233",
    MINTER_SEED: process.env.MINTER_SEED || "",
    MINTER_ADDRESS: process.env.MINTER_ADDRESS || "",
    NFT_TAXON: parseInt(process.env.NFT_TAXON || "0", 10),
    NFT_TRANSFER_FEE: parseInt(process.env.NFT_TRANSFER_FEE || "0", 10),
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    SOLANA_MINTER_ADDRESS: process.env.SOLANA_MINTER_ADDRESS || "",
    SOLANA_MINTER_SECRET_KEY: process.env.SOLANA_MINTER_SECRET_KEY || "",
    SOLANA_CLUSTER: process.env.SOLANA_CLUSTER || "devnet",
    PORT: parseInt(process.env.PORT || "3000", 10)
};
