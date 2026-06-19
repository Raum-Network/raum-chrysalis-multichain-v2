import { getSolanaStakingNFTs } from "../server/services/solanaReceiptNftService.js";

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { success: false, error: "Method not allowed" });
  }

  const owner = req.query.owner;
  if (!owner) {
    return json(res, 400, { success: false, error: "Missing owner query param" });
  }

  try {
    const receipts = await getSolanaStakingNFTs(owner);
    return json(res, 200, { success: true, receipts });
  } catch (error) {
    return json(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch Solana staking NFTs",
    });
  }
}
