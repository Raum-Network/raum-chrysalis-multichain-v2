import dotenv from "dotenv";
dotenv.config();

export default {
    XRPL_NODE: process.env.XRPL_NODE || "wss://s.altnet.rippletest.net:51233",
    MINTER_SEED: process.env.MINTER_SEED || "",
    MINTER_ADDRESS: process.env.MINTER_ADDRESS || "",
    NFT_TAXON: parseInt(process.env.NFT_TAXON || "0", 10),
    NFT_TRANSFER_FEE: parseInt(process.env.NFT_TRANSFER_FEE || "0", 10),
    PORT: 3000
};
