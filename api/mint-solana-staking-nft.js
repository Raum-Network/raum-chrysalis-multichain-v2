import { mintSolanaStakingNFT } from "../server/services/solanaReceiptNftService.js";

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return typeof req.body === "object" ? req.body : {};
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { success: false, error: "Method not allowed" });
  }

  const {
    stakerAddress,
    stakedAmount,
    stakedToken,
    stakingPool,
    stakingPeriodDays,
    apy,
    confirmationTxHash,
    mintedStETH,
  } = parseBody(req);

  if (!stakerAddress || !stakedAmount || !stakingPool) {
    return json(res, 400, {
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
      mintedStETH: mintedStETH || "0",
    });

    return json(res, 201, {
      success: true,
      ...result,
      instructions: "The Solana staking receipt NFT has been minted directly into the user's associated token account.",
    });
  } catch (error) {
    return json(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Solana NFT mint failed",
    });
  }
}
