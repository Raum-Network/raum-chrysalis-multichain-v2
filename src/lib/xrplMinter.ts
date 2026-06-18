const API_BASE = (import.meta.env.VITE_SOLANA_NFT_API_URL || "/api").replace(/\/+$/, "");

export async function reserveNftId(): Promise<{ reservedSequence: number; nfTokenID: string }> {
  const response = await fetch(`${API_BASE}/reserve-nft-id`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to reserve XRPL NFT ID");
  }

  return {
    reservedSequence: Number(data.reservedSequence),
    nfTokenID: data.nfTokenID,
  };
}

export async function mintStakingNFT(params: {
  stakerAddress: string;
  stakedAmount: string;
  stakedToken?: string;
  stakingPool: string;
  stakingPeriodDays?: number;
  apy?: string;
  confirmationTxHash?: string;
  mintedStETH?: string;
  reservedSequence?: number;
}): Promise<{
  nfTokenID: string;
  offerID: string | null;
  mintTxHash: string;
  offerTxHash: string;
  metadata: Record<string, unknown>;
}> {
  const response = await fetch(`${API_BASE}/mint-staking-nft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to mint XRPL staking NFT");
  }

  return data;
}
