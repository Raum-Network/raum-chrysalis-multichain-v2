export type SolanaStakingReceipt = {
  v: string;
  type?: string;
  staker: string;
  amount: string;
  token: string;
  pool: string;
  days: number;
  mintedStETH: string;
  apy: string;
  stakedAt: number;
  txHash?: string;
  id: string;
};

export type SolanaStakingNFT = {
  id: string;
  mintAddress: string;
  tokenAccount: string;
  owner: string;
  mintTxHash: string;
  metadataAddress?: string;
  metadataTxHash?: string;
  metadataUri?: string;
  metadataName?: string;
  metadataSymbol?: string;
  revokeMintAuthorityTxHash?: string;
  receipt: SolanaStakingReceipt;
  explorerUrl?: string;
  createdAt: number;
};

const API_BASE = (import.meta.env.VITE_SOLANA_NFT_API_URL || "/api").replace(/\/+$/, "");

export async function mintSolanaStakingNFT(params: {
  stakerAddress: string;
  stakedAmount: string;
  stakedToken?: string;
  stakingPool: string;
  stakingPeriodDays?: number;
  apy?: string;
  confirmationTxHash?: string;
  mintedStETH?: string;
}): Promise<SolanaStakingNFT> {
  const response = await fetch(`${API_BASE}/mint-solana-staking-nft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to mint Solana staking NFT");
  }

  return data as SolanaStakingNFT;
}

export async function fetchSolanaStakingNFTs(owner: string): Promise<SolanaStakingNFT[]> {
  const response = await fetch(`${API_BASE}/solana-staking-nfts/${owner}`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch Solana staking NFTs");
  }

  return data.receipts || [];
}
