import { useState, useEffect, useRef } from 'react';
import { useWallet } from '../lib/walletConnect';
import { useWriteContract, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import stakedUserBalance from '../lib/sepoliaContract';
import { decodeAccountID } from "xrpl";
import { ethers } from 'ethers';
import { reserveNftId, mintStakingNFT } from '../lib/xrplMinter';
import {
  SolanaStakingNFT,
  fetchSolanaStakingNFTs,
  mintSolanaStakingNFT,
} from '../lib/solanaReceiptMinter';
import { BridgeProtocol } from '../config/contract';
import { isProtocolSupported, isZeroAddress, normalizeEvmAddress, ZERO_ADDRESS } from '../lib/networkSupport';
import { createPersistedTransactionId, upsertPersistedTransaction } from '../services/transactionRepository';
import { burnSolanaUsdcForSepoliaCCTP, solanaAddressToEvmAlias } from '../lib/solanaCctp';
import {
  sendSolanaCcip,
  estimateCcipFee,
  getSolanaTokenBalance,
  LINK_MINT,
  WSOL_MINT,
  type FeeToken,
  type CcipFeeEstimate,
} from '../lib/solanaCcip';
import { PublicKey } from '@solana/web3.js';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Buffer } from "buffer";

export interface StakingReceipt {
  v: string;
  type: string;
  staker: string;
  amount: string;
  token: string;
  pool: string;
  days: number;
  apy: string;
  stakedAt: number;
  expiresAt?: number;
  txHash?: string;
  id: string;
  mintedStETH?: string;
}

type XrplOfferObject = {
  Destination?: string;
  NFTokenID: string;
  index: string;
};

const USDC_MINTED_EVENT_TOPIC = ethers.id('USDCMinted(address,uint256,bytes)');
const SOLANA_USDC_MINTED_EVENT_TOPIC = ethers.id('USDCMinted(address,bytes32,uint256,uint256,bytes)');
const SOLANA_STAKE_RECEIPT_READY_TOPIC = ethers.id('SolanaStakeReceiptReady(bytes32,address,bytes32,uint256,uint256,bytes32,bytes)');
const receiverInterface = new ethers.Interface([
  'event USDCMinted(address indexed recipient, uint256 amount, bytes hookData)',
  'event USDCMinted(address indexed recipientAlias, bytes32 indexed solanaRecipient, uint256 usdcAmount, uint256 mintedStETH, bytes hookData)',
  'event SolanaStakeReceiptReady(bytes32 indexed route, address indexed recipientAlias, bytes32 indexed solanaRecipient, uint256 sourceAmount, uint256 mintedStETH, bytes32 messageId, bytes hookData)'
]);

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function evmAddressToAscii(address: string): string {
  const cleanAddress = address.replace('0x', '').toLowerCase();
  return Array.from(cleanAddress)
    .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

function toUnits(amount: number, decimals: number): bigint {
  return ethers.parseUnits(amount.toString(), decimals);
}

function toBytes32Address(address: string): `0x${string}` {
  const normalized = normalizeEvmAddress(address);
  return `0x000000000000000000000000${normalized.slice(2)}` as `0x${string}`;
}

const toPersistedStatus = (status: StakeStatus['status']) => {
  if (status === 'SUCCESS') return 'SUCCESS' as const;
  if (status === 'FAILURE') return 'FAILURE' as const;
  return 'IN_PROGRESS' as const;
};

export function useStaking() {
  const { address, networkConfig, chainId } = useWallet();
  const [stakeStatus, setStakeStatus] = useState<StakeStatus | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [bridgeProtocol, setBridgeProtocol] = useState<BridgeProtocol>(networkConfig.supportedProtocols[0]);
  const [isApproving, setIsApproving] = useState(false);
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [xrpBalance, setXrpBalance] = useState<number>(0);
  const [solanaUsdcBalance, setSolanaUsdcBalance] = useState<number>(0);
  const [solanaLinkBalance, setSolanaLinkBalance] = useState<number>(0);
  const [solanaWsolBalance, setSolanaWsolBalance] = useState<number>(0);
  const [solanaCcipFeeToken, setSolanaCcipFeeToken] = useState<FeeToken>('LINK');
  const [solanaCcipFeeEst, setSolanaCcipFeeEst] = useState<CcipFeeEstimate | null>(null);
  const [stakingNFTs, setStakingNFTs] = useState<{ id: string, receipt: StakingReceipt }[]>([]);
  const [stakingOffers, setStakingOffers] = useState<{ id: string, receipt: StakingReceipt, offerIndex: string }[]>([]);
  const [solanaStakingNFTs, setSolanaStakingNFTs] = useState<SolanaStakingNFT[]>([]);
  const persistedTransactionWritesRef = useRef(new Map<string, string>());
  const mintedSolanaReceiptRef = useRef(new Set<string>());

  const { writeContractAsync } = useWriteContract();

  const evmAddress = address && address.startsWith('0x') ? (address as `0x${string}`) : undefined;
  const isEvmNetwork = (networkConfig.chainFamily || 'evm') === 'evm';
  const decimals = networkConfig.contracts.decimal || 6;

  const USDC_ADDRESS = isEvmNetwork ? normalizeEvmAddress(networkConfig.contracts.usdc) : ZERO_ADDRESS;
  const LINK_ADDRESS = isEvmNetwork ? normalizeEvmAddress(networkConfig.contracts.fees) : ZERO_ADDRESS;
  const STAKE_CONTRACT_ADDRESS = isEvmNetwork ? normalizeEvmAddress(networkConfig.contracts.ccip) : ZERO_ADDRESS;
  const STAKE_CCTP_CONTRACT_ADDRESS = isEvmNetwork ? normalizeEvmAddress(networkConfig.contracts.cctp) : ZERO_ADDRESS;

  const persistStakeStatus = (status: StakeStatus, protocol: BridgeProtocol, rawAmount: string) => {
    if (!address || !status.sourceTxHash) return;

    const sourceNetworkName = status.sourceNetworkName || networkConfig.name;
    const destNetworkName = status.destNetworkName || 'Sepolia';
    const sourceDecimals = status.sourceDecimals ?? decimals;
    const destDecimals = status.destDecimals ?? 6;
    const amount = status.amount ? String(status.amount) : rawAmount;
    const now = Date.now();
    const messageId = status.ccipMessageId || status.sourceTxHash;
    const id = createPersistedTransactionId(protocol, status.sourceTxHash, messageId);
    const normalizedStatus = toPersistedStatus(status.status);
    const payloadSignature = JSON.stringify({
      id,
      walletAddress: address.toLowerCase(),
      protocol,
      messageId,
      sourceTxHash: status.sourceTxHash,
      destinationTxHash: status.destinationTxHash || '',
      sourceNetworkName,
      destNetworkName,
      sender: status.origin || address,
      receiver: status.receiver || networkConfig.contracts.destination || '',
      amount,
      assetSymbol: protocol === 'Axelar ITS' ? 'XRP' : 'USDC',
      sourceDecimals,
      destDecimals,
      status: normalizedStatus,
      attestationStatus: status.attestationStatus || '',
      createdAt: status.timestamp || now,
    });

    if (persistedTransactionWritesRef.current.get(id) === payloadSignature) {
      return;
    }

    persistedTransactionWritesRef.current.set(id, payloadSignature);

    void upsertPersistedTransaction({
      id,
      walletAddress: address,
      protocol,
      messageId,
      sourceTxHash: status.sourceTxHash,
      destinationTxHash: status.destinationTxHash || undefined,
      sourceNetworkName,
      destNetworkName,
      sender: status.origin || address,
      receiver: status.receiver || networkConfig.contracts.destination || '',
      amount,
      assetSymbol: protocol === 'Axelar ITS' ? 'XRP' : 'USDC',
      sourceDecimals,
      destDecimals,
      status: normalizedStatus,
      attestationStatus: status.attestationStatus,
      createdAt: status.timestamp || now,
      updatedAt: now,
    });
  };

  const handleStakeStatusUpdate = (protocol: BridgeProtocol, rawAmount: string) => (status: StakeStatus) => {
    setStakeStatus(status);
    persistStakeStatus(status, protocol, rawAmount);
  };

  useEffect(() => {
    stakeManager.updateChainId(chainId);
    stakedUserBalance.updateChainId(chainId);
  }, [chainId]);

  useEffect(() => {
    if (!isProtocolSupported(networkConfig, bridgeProtocol)) {
      setBridgeProtocol(networkConfig.supportedProtocols[0]);
    }
  }, [bridgeProtocol, networkConfig]);

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: evmAddress ? [evmAddress] : undefined,
    query: {
      enabled: Boolean(evmAddress) && isEvmNetwork && networkConfig.assetSymbol === 'USDC' && !isZeroAddress(USDC_ADDRESS),
    }
  });

  // Read allowances
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: evmAddress ? [evmAddress, bridgeProtocol === 'CCIP' ? STAKE_CONTRACT_ADDRESS : STAKE_CCTP_CONTRACT_ADDRESS] : undefined,
    query: {
      enabled:
        Boolean(evmAddress) &&
        isEvmNetwork &&
        bridgeProtocol !== 'Axelar ITS' &&
        networkConfig.assetSymbol === 'USDC' &&
        !isZeroAddress(USDC_ADDRESS),
    }
  });

  // Read LINK balance and allowance only when CCIP is relevant
  const { data: linkBalance } = useReadContract({
    address: LINK_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: evmAddress ? [evmAddress] : undefined,
    query: {
      enabled:
        Boolean(evmAddress) &&
        isEvmNetwork &&
        bridgeProtocol === 'CCIP' &&
        isProtocolSupported(networkConfig, 'CCIP') &&
        !isZeroAddress(LINK_ADDRESS),
    }
  });

  const { data: linkAllowance, refetch: refetchLinkAllowance } = useReadContract({
    address: LINK_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: evmAddress ? [evmAddress, STAKE_CONTRACT_ADDRESS] : undefined,
    query: {
      enabled:
        Boolean(evmAddress) &&
        isEvmNetwork &&
        bridgeProtocol === 'CCIP' &&
        isProtocolSupported(networkConfig, 'CCIP') &&
        !isZeroAddress(LINK_ADDRESS),
    }
  });

  // Single consolidated XRPL fetch: balance + NFTs + offers in one connection.
  useEffect(() => {
    let active = true;

    const fetchAllXrplData = async () => {
      if (!address || !isProtocolSupported(networkConfig, 'Axelar ITS')) {
        if (active) {
          setXrpBalance(0);
          setStakingNFTs([]);
          setStakingOffers([]);
        }
        return;
      }

      try {
        const { Client } = await import('xrpl');
        const clientUrl = networkConfig.wssUrl || "wss://s.altnet.rippletest.net:51233";
        const client = new Client(clientUrl, { connectionTimeout: 20000 });
        await client.connect();

        const minterAddress = "r4S8m71NRjGci4RMamf2c8czegeRsiwF3D";
        const [balanceRes, userNftsRes, minterOffersRes] = await Promise.all([
          client.request({ command: 'account_info', account: address, ledger_index: 'validated' }),
          client.request({ command: 'account_nfts', account: address, ledger_index: 'validated' }),
          client.request({ command: 'account_objects', account: minterAddress, type: 'nft_offer', ledger_index: 'validated' }),
        ]);

        await client.disconnect();
        if (!active) return;

        const balanceInXrp = Number(balanceRes.result.account_data.Balance) / 1_000_000;
        setXrpBalance(balanceInXrp);

        const nfts = userNftsRes.result?.account_nfts;
        if (nfts && Array.isArray(nfts)) {
          const receipts: { id: string, receipt: StakingReceipt }[] = [];
          for (const nft of nfts) {
            if (!nft.URI) continue;
            try {
              const decodedRaw = Buffer.from(nft.URI, "hex").toString("utf8");
              if (!decodedRaw.startsWith("data:application/json,")) continue;

              const jsonString = decodedRaw.slice("data:application/json,".length);
              const parsed = JSON.parse(jsonString);
              if (parsed.type !== "stake" && parsed.v !== "1") continue;

              const receipt: StakingReceipt = {
                v: parsed.v || "1",
                type: parsed.type || "stake",
                staker: parsed.staker || parsed.s || "",
                amount: parsed.amount || parsed.a || "0",
                token: parsed.token || parsed.t || "XRP",
                pool: parsed.pool || parsed.p || "Raum",
                days: parsed.days || parsed.d || 0,
                apy: parsed.apy || parsed.y || "0",
                stakedAt: parsed.stakedAt || parsed.ts || 0,
                txHash: parsed.txHash || parsed.h || "",
                id: parsed.id || "",
                mintedStETH: parsed.mintedStETH || parsed.e || "0",
              };
              if (receipt.pool === 'Raum') receipt.pool = 'Raum LST Axelar ITS';
              receipts.push({ id: nft.NFTokenID, receipt });
            } catch {
              // Ignore parse errors.
            }
          }
          receipts.sort((a, b) => (b.receipt.stakedAt || 0) - (a.receipt.stakedAt || 0));
          setStakingNFTs(receipts);
        } else {
          setStakingNFTs([]);
        }

        const allOffers = (minterOffersRes.result?.account_objects || []) as XrplOfferObject[];
        const userOffers = allOffers.filter((obj) => obj.Destination === address);

        if (userOffers.length > 0) {
          const client2 = new Client(clientUrl, { connectionTimeout: 20000 });
          await client2.connect();
          const minterNftsRes = await client2.request({
            command: 'account_nfts', account: minterAddress, ledger_index: 'validated'
          });
          await client2.disconnect();

          const minterNfts = minterNftsRes.result?.account_nfts || [];
          const nftUriMap = new Map<string, StakingReceipt>();
          for (const mnft of minterNfts) {
            if (!mnft.URI) continue;
            try {
              const raw = Buffer.from(mnft.URI, "hex").toString("utf8");
              if (!raw.startsWith("data:application/json,")) continue;

              const parsed = JSON.parse(raw.slice("data:application/json,".length));
              const receipt: StakingReceipt = {
                v: parsed.v || "1",
                type: parsed.type || "stake",
                staker: parsed.staker || parsed.s || "",
                amount: parsed.amount || parsed.a || "0",
                token: parsed.token || parsed.t || "XRP",
                pool: parsed.pool || parsed.p || "Raum",
                days: parsed.days || parsed.d || 0,
                apy: parsed.apy || parsed.y || "0",
                stakedAt: parsed.stakedAt || parsed.ts || 0,
                txHash: parsed.txHash || parsed.h || "",
                id: parsed.id || "",
                mintedStETH: parsed.mintedStETH || parsed.e || "0",
              };
              if (receipt.pool === 'Raum') receipt.pool = 'Raum LST Axelar ITS';
              nftUriMap.set(mnft.NFTokenID, receipt);
            } catch {
              // Ignore parse errors.
            }
          }

          const fetchedOffers: { id: string, receipt: StakingReceipt, offerIndex: string }[] = [];
          for (const offer of userOffers) {
            const nftId = offer.NFTokenID;
            const receipt = nftUriMap.get(nftId);
            if (receipt) {
              fetchedOffers.push({ id: nftId, offerIndex: offer.index, receipt });
            }
          }
          fetchedOffers.sort((a, b) => (b.receipt?.stakedAt || 0) - (a.receipt?.stakedAt || 0));
          setStakingOffers(fetchedOffers);
        } else {
          setStakingOffers([]);
        }
      } catch (error) {
        console.error("Error fetching XRPL data:", error);
      }
    };

    fetchAllXrplData();
    const intervalId = setInterval(fetchAllXrplData, 15000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [address, networkConfig]);

  // Fetch Solana LINK and wSOL SPL token balances (for CCIP fee token selection)
  useEffect(() => {
    let active = true;

    const fetchSolanaFeeBalances = async () => {
      if (!address || networkConfig.chainFamily !== 'solana') {
        if (active) { setSolanaLinkBalance(0); setSolanaWsolBalance(0); }
        return;
      }
      const rpc = networkConfig.publicRpc;
      const [link, wsol] = await Promise.all([
        getSolanaTokenBalance(rpc, address, LINK_MINT.toString()),
        getSolanaTokenBalance(rpc, address, WSOL_MINT.toString()),
      ]);
      if (active) {
        setSolanaLinkBalance(link);
        setSolanaWsolBalance(wsol);
        // Auto-select fee token: prefer LINK if user has any, else wSOL
        setSolanaCcipFeeToken(link > 0 ? 'LINK' : 'wSOL');
      }
    };

    fetchSolanaFeeBalances();
    const id = setInterval(fetchSolanaFeeBalances, 15000);
    return () => { active = false; clearInterval(id); };
  }, [address, networkConfig]);

  // Fetch Solana USDC SPL token balance (EVM useReadContract is disabled for Solana)
  useEffect(() => {
    let active = true;

    const fetchSolanaUsdcBalance = async () => {
      if (!address || networkConfig.chainFamily !== 'solana') {
        if (active) setSolanaUsdcBalance(0);
        return;
      }

      const usdcMint = networkConfig.solana?.usdcMint || networkConfig.contracts.usdc;
      if (!usdcMint) return;

      try {
        const response = await fetch(networkConfig.publicRpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [
              address,
              { mint: usdcMint },
              { encoding: 'jsonParsed' }
            ]
          })
        });
        const data = await response.json();
        const accounts = data?.result?.value || [];
        if (accounts.length === 0) {
          if (active) setSolanaUsdcBalance(0);
          return;
        }
        // Sum across all USDC token accounts (usually just one)
        const totalLamports: number = accounts.reduce((sum: number, acc: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } }) => {
          return sum + (acc.account.data.parsed.info.tokenAmount.uiAmount || 0);
        }, 0);
        if (active) setSolanaUsdcBalance(totalLamports);
      } catch (e) {
        console.error('Error fetching Solana USDC balance:', e);
        if (active) setSolanaUsdcBalance(0);
      }
    };

    fetchSolanaUsdcBalance();
    const intervalId = setInterval(fetchSolanaUsdcBalance, 15000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [address, networkConfig]);

  useEffect(() => {
    let active = true;

    const fetchSolanaReceipts = async () => {
      if (!address || networkConfig.chainFamily !== 'solana') {
        if (active) setSolanaStakingNFTs([]);
        return;
      }

      try {
        const receipts = await fetchSolanaStakingNFTs(address);
        if (active) setSolanaStakingNFTs(receipts);
      } catch (error) {
        console.error("Error fetching Solana staking NFTs:", error);
        if (active) setSolanaStakingNFTs([]);
      }
    };

    fetchSolanaReceipts();
    const intervalId = setInterval(fetchSolanaReceipts, 15000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [address, networkConfig]);

  const mintSolanaReceiptNFT = async ({
    amount,
    apy,
    confirmationTxHash,
    mintedStETH,
  }: {
    amount: string;
    apy?: string;
    confirmationTxHash?: string;
    mintedStETH: string;
  }) => {
    if (!address || networkConfig.chainFamily !== 'solana') return;
    const dedupeKey = `${address}:${confirmationTxHash || ''}:${amount}:${mintedStETH}`;
    if (mintedSolanaReceiptRef.current.has(dedupeKey)) return;
    mintedSolanaReceiptRef.current.add(dedupeKey);

    const receipt = await mintSolanaStakingNFT({
      stakerAddress: address,
      stakedAmount: amount,
      stakedToken: 'USDC',
      stakingPool: 'Raum LST Solana CCTP',
      stakingPeriodDays: 0,
      apy: apy || '4.8',
      confirmationTxHash: confirmationTxHash || '',
      mintedStETH,
    });

    setSolanaStakingNFTs((current) => [receipt, ...current.filter((item) => item.id !== receipt.id)]);
  };

  const getMintedStETHFromSepoliaReceipt = async (destinationTxHash: string): Promise<string | null> => {
    const provider = stakedUserBalance.getProvider();
    const receipt = await provider.getTransactionReceipt(destinationTxHash);
    const mintedLog = receipt?.logs.find((log) =>
      log.topics[0]?.toLowerCase() === SOLANA_STAKE_RECEIPT_READY_TOPIC.toLowerCase() ||
      log.topics[0]?.toLowerCase() === SOLANA_USDC_MINTED_EVENT_TOPIC.toLowerCase() ||
      log.topics[0]?.toLowerCase() === USDC_MINTED_EVENT_TOPIC.toLowerCase()
    );
    if (!mintedLog) return null;

    const parsed = receiverInterface.parseLog({
      topics: [...mintedLog.topics],
      data: mintedLog.data,
    });
    const amount = parsed?.args?.mintedStETH ?? parsed?.args?.amount;
    return amount !== undefined ? ethers.formatUnits(amount, 18) : null;
  };

  useEffect(() => {
    if (!address || networkConfig.chainFamily !== 'solana') return;

    const unsubscribe = stakeManager.subscribeToStatus(async (status) => {
      if (status.status !== 'SUCCESS' || !status.destinationTxHash) return;

      try {
        const mintedStETH = await getMintedStETHFromSepoliaReceipt(status.destinationTxHash);
        if (!mintedStETH) return;

        await mintSolanaReceiptNFT({
          amount: status.amount ? ethers.formatUnits(BigInt(status.amount), status.sourceDecimals ?? decimals) : stakeAmount.toString(),
          apy: undefined,
          confirmationTxHash: status.destinationTxHash,
          mintedStETH,
        });
      } catch (error) {
        console.error('Failed to mint Solana staking receipt NFT:', error);
      }
    });

    return () => unsubscribe();
  }, [address, networkConfig, decimals, stakeAmount]);

  const approveToken = async (amount: number) => {
    if (!address) throw new Error('Wallet not connected');
    if (bridgeProtocol === 'Axelar ITS') return;
    if (!evmAddress) throw new Error('Please connect an EVM wallet for this protocol');

    setIsApproving(true);
    try {
      const amountInWei = toUnits(amount, decimals);

      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [bridgeProtocol === 'CCIP' ? STAKE_CONTRACT_ADDRESS : STAKE_CCTP_CONTRACT_ADDRESS, amountInWei],
      });
      await refetchUsdcAllowance();

      if (bridgeProtocol === 'CCIP') {
        await writeContractAsync({
          address: LINK_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [STAKE_CONTRACT_ADDRESS, BigInt(10 * 10 ** 18)],
        });
        await refetchLinkAllowance();
      }
    } catch (error) {
      console.error('Approval failed:', error);
      throw error;
    } finally {
      setIsApproving(false);
    }
  };

  const checkAllowance = async (amount: number): Promise<boolean> => {
    if (!address) return false;
    if (bridgeProtocol === 'Axelar ITS') return true;
    if (networkConfig.chainFamily === 'solana') return true;
    if (!evmAddress) return false;
    if (!isProtocolSupported(networkConfig, bridgeProtocol)) return false;

    const amountInWei = toUnits(amount, decimals);
    const hasUsdcAllowance = (usdcAllowance || BigInt(0)) >= amountInWei;

    if (bridgeProtocol === 'CCIP') {
      const hasLinkAllowance = (linkAllowance || BigInt(0)) >= BigInt(10 * 10 ** 18);
      return hasUsdcAllowance && hasLinkAllowance;
    }

    return hasUsdcAllowance;
  };

  const stake = async (amount: number, apy?: string) => {
    if (!address) throw new Error('Wallet not connected');

    try {
      setIsStaking(true);
      setStakeAmount(amount);

      if (bridgeProtocol === 'Axelar ITS') {
        const amountInDrops = Math.round(Number(amount) * 1_000_000).toString();
        const depositAddress = networkConfig.contracts.destination;
        const evmAddressDestination = normalizeEvmAddress(networkConfig.contracts.cctpDestinationCaller || ZERO_ADDRESS);
        const addressInAscii = evmAddressToAscii(evmAddressDestination);

        const accountIDBytes = decodeAccountID(address);
        const xrplToEVMAddress = `0x${Buffer.from(accountIDBytes).toString("hex")}`;

        let axelarGasDrops = "2000000";
        try {
          const feeRes = await fetch("https://testnet.api.gmp.axelarscan.io/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              method: "estimateITSFee",
              sourceChain: "xrpl",
              destinationChain: "ethereum-sepolia",
              sourceTokenSymbol: "XRP",
              gasLimit: 500000,
              gasMultiplier: "auto",
              showDetailedFees: true
            })
          });
          const feeData = await feeRes.json();
          if (feeData && feeData.totalFee && !isNaN(Number(feeData.totalFee))) {
            axelarGasDrops = feeData.totalFee.toString();
          }
        } catch (e) {
          console.error("Axelar ITS fee estimate failed, using fallback", e);
        }

        let deterministicNfTokenId: string | undefined;
        try {
          const reserveData = await reserveNftId();
          deterministicNfTokenId = reserveData.nfTokenID;
        } catch (e) {
          console.error("NFT pre-computation failed:", e);
          throw new Error("Could not deterministically calculate the staking NFT ID.");
        }

        const coder = ethers.AbiCoder.defaultAbiCoder();
        const encodedPayload = coder.encode(
          ["address", "string"],
          [xrplToEVMAddress, deterministicNfTokenId || ""]
        );

        const memos = [
          { Memo: { MemoType: toHex("type"), MemoData: toHex("interchain_transfer") } },
          { Memo: { MemoType: toHex("destination_address"), MemoData: addressInAscii } },
          { Memo: { MemoType: toHex("destination_chain"), MemoData: toHex("ethereum-sepolia") } },
          { Memo: { MemoType: toHex("gas_fee_amount"), MemoData: toHex(axelarGasDrops) } },
          { Memo: { MemoType: toHex("payload"), MemoData: encodedPayload.slice(2) } }
        ];

        const payment = {
          TransactionType: "Payment",
          Account: address,
          Destination: depositAddress,
          Amount: amountInDrops,
          Memos: memos,
        };

        const crossmarkSdk = window.xrpl?.crossmark || window.crossmark;
        if (!crossmarkSdk) throw new Error("Crossmark extension not found");

        let result;
        try {
          if (crossmarkSdk.methods && typeof crossmarkSdk.methods.signAndSubmitAndWait === 'function') {
            result = await crossmarkSdk.methods.signAndSubmitAndWait(payment);
          } else if (typeof crossmarkSdk.signAndSubmitAndWait === 'function') {
            result = await crossmarkSdk.signAndSubmitAndWait(payment);
          } else if (crossmarkSdk.methods && typeof crossmarkSdk.methods.signAndSubmit === 'function') {
            result = await crossmarkSdk.methods.signAndSubmit(payment);
          } else if (typeof crossmarkSdk.signAndSubmit === 'function') {
            result = await crossmarkSdk.signAndSubmit(payment);
          } else {
            throw new Error("signAndSubmit not found on crossmark SDK");
          }
        } catch (sdkError: unknown) {
          console.error("SDK Error:", sdkError);
          throw new Error("User rejected the request or transaction failed");
        }

        const hash = result?.response?.data?.resp?.result?.hash ||
          result?.response?.data?.resp?.result?.tx_json?.hash ||
          result?.response?.data?.hash ||
          result?.hash;

        if (hash) {
          const axelarStatusHandler = handleStakeStatusUpdate('Axelar ITS', amountInDrops);
          stakeManager.setExternalStatus({
            status: 'IN_PROGRESS',
            sourceTxHash: hash,
            ccipMessageId: null,
            destinationTxHash: null,
            bridgingMessageId: null,
            timestamp: Date.now(),
            timeElapsed: '0s',
            expectedTime: '15m 00s',
            isCommitted: false,
            isBlessed: false,
            sourceNetworkName: networkConfig.name,
            destNetworkName: 'Sepolia',
            origin: address,
            protocol: 'Axelar ITS',
            amount: Number(amountInDrops),
            sourceDecimals: 6,
            destDecimals: 6
          }, axelarStatusHandler);

          let hasMinted = false;
          const preExecutionBalance = await getStakedBalance();

          stakeManager.startPollingAxelarStatus(hash, Date.now(), async (status) => {
            axelarStatusHandler(status);
            if (status.status === 'SUCCESS' && !hasMinted) {
              hasMinted = true;
              await new Promise(resolve => setTimeout(resolve, 3000));
              const postExecutionBalance = await getStakedBalance();
              const mintedStETH = Math.max(0, Number(postExecutionBalance) - Number(preExecutionBalance)).toFixed(6);

              mintStakingNFT({
                stakerAddress: address,
                stakedAmount: amount.toString(),
                stakedToken: 'XRP',
                stakingPool: 'Raum LST Axelar ITS',
                stakingPeriodDays: 0,
                apy: apy || "4.8",
                confirmationTxHash: hash,
                mintedStETH: mintedStETH.toString()
              })
                .then(() => {
                  setIsStaking(false);
                })
                .catch((err) => {
                  console.error('Failed to trigger staking NFT mint:', err);
                  setIsStaking(false);
                });
            }
          });
        } else if (result?.response?.data?.error || result?.error) {
          throw new Error(result?.response?.data?.error || result?.error || "Transaction was rejected or failed");
        } else {
          throw new Error("Transaction hash not returned");
        }
        return;
      }

      if (networkConfig.chainFamily === 'solana') {
        if (!window.solana) throw new Error('Solana wallet not found');
        const stakeAmountInWei = toUnits(amount, decimals);

        // ── CCIP path ────────────────────────────────────────────────────────
        if (bridgeProtocol === 'CCIP') {
          const feeToken = solanaCcipFeeToken;
          const hasFee = feeToken === 'LINK' ? solanaLinkBalance > 0 : solanaWsolBalance > 0;
          if (!hasFee) {
            throw new Error(
              feeToken === 'LINK'
                ? 'No LINK balance for CCIP fees. Please acquire LINK or switch to wSOL.'
                : 'No wSOL balance for CCIP fees. Please wrap some SOL or switch to LINK.'
            );
          }

          // ABI-encode (address recipientAlias, bytes32 solanaRecipient) for the receiver contract
          const evmAlias        = solanaAddressToEvmAlias(address);
          const solanaBytes32   = `0x${Buffer.from(new PublicKey(address).toBytes()).toString('hex')}`;
          const abiCoder        = ethers.AbiCoder.defaultAbiCoder();
          const evmCalldata     = ethers.getBytes(
            abiCoder.encode(['address', 'bytes32'], [evmAlias, solanaBytes32])
          );

          const ccipStatusHandler = handleStakeStatusUpdate('CCIP', stakeAmountInWei.toString());

          const txHash = await sendSolanaCcip({
            provider: window.solana,
            networkConfig,
            amount: stakeAmountInWei,
            evmCalldata,
            feeToken,
            gasLimit: 200_000n,
          });

          stakeManager.setExternalStatus({
            status: 'IN_PROGRESS',
            sourceTxHash: txHash,
            ccipMessageId: null,
            destinationTxHash: null,
            bridgingMessageId: null,
            timestamp: Date.now(),
            timeElapsed: '0s',
            expectedTime: '20m 00s',
            isCommitted: false,
            isBlessed: false,
            sourceNetworkName: networkConfig.name,
            destNetworkName: 'Sepolia',
            origin: address,
            receiver: evmAlias,
            protocol: 'CCIP',
            amount: Number(stakeAmountInWei),
            sourceDecimals: decimals,
            destDecimals: 18,
          }, ccipStatusHandler);

          return;
        }

        // ── CCTP path (existing) ─────────────────────────────────────────────
        const destinationCaller = normalizeEvmAddress(networkConfig.contracts.cctpDestinationCaller);
        if (isZeroAddress(destinationCaller)) {
          throw new Error(`CCTP destination caller is not configured for ${networkConfig.name}`);
        }

        const evmAlias = solanaAddressToEvmAlias(address);
        const solanaStatusHandler = handleStakeStatusUpdate('CCTP', stakeAmountInWei.toString());
        const txHash = await burnSolanaUsdcForSepoliaCCTP({
          provider: window.solana,
          networkConfig,
          amount: stakeAmountInWei,
        });

        stakeManager.setExternalStatus({
          status: 'IN_PROGRESS',
          sourceTxHash: txHash,
          ccipMessageId: null,
          destinationTxHash: null,
          bridgingMessageId: null,
          timestamp: Date.now(),
          timeElapsed: '0s',
          expectedTime: '1m 00s',
          isCommitted: false,
          isBlessed: false,
          sourceNetworkName: networkConfig.name,
          destNetworkName: 'Sepolia',
          origin: address,
          receiver: evmAlias,
          protocol: 'CCTP',
          amount: Number(stakeAmountInWei),
          sourceDecimals: decimals,
          destDecimals: 18,
          attestationStatus: 'pending',
        }, solanaStatusHandler);

        await stakeManager.completeSolanaCCTP(
          txHash,
          Number(stakeAmountInWei),
          evmAlias,
          address,
          solanaStatusHandler
        );
        return;
      }

      if (!evmAddress) throw new Error('Please connect an EVM wallet for this protocol');
      if (!isProtocolSupported(networkConfig, bridgeProtocol)) {
        throw new Error(`${bridgeProtocol} is not supported on ${networkConfig.name}`);
      }

      const hasAllowance = await checkAllowance(amount);
      if (!hasAllowance) {
        await approveToken(amount);
      }

      const stakeAmountInWei = Number(toUnits(amount, decimals));
      if (bridgeProtocol === 'CCIP') {
        const ccipStatusHandler = handleStakeStatusUpdate('CCIP', stakeAmountInWei.toString());
        await stakeManager.stake(
          "16015286601757825753",
          normalizeEvmAddress(networkConfig.contracts.destination),
          stakeAmountInWei,
          "999999",
          writeContractAsync,
          ccipStatusHandler
        );
      } else if (bridgeProtocol === 'CCTP') {
        const destinationCaller = normalizeEvmAddress(networkConfig.contracts.cctpDestinationCaller);
        if (isZeroAddress(destinationCaller)) {
          throw new Error(`CCTP destination caller is not configured for ${networkConfig.name}`);
        }

        const destinationCallerBytes32 = toBytes32Address(destinationCaller);
        const cctpStatusHandler = handleStakeStatusUpdate('CCTP', stakeAmountInWei.toString());
        await stakeManager.stakeCCTP(
          stakeAmountInWei,
          networkConfig.destinationDomain ?? 0,
          destinationCallerBytes32,
          USDC_ADDRESS,
          destinationCallerBytes32,
          evmAddress,
          writeContractAsync,
          cctpStatusHandler
        );
      }
    } catch (error) {
      console.error('Staking failed:', error);
      throw error;
    } finally {
      setIsStaking(false);
    }
  };

  const getStakedBalance = async () => {
    if (!address) return "0";
    if (networkConfig.chainFamily === 'solana') return "0";
    try {
      const balance = await stakedUserBalance.getBalance(address);
      const cctpBalance = await stakedUserBalance.getBalanceCCTP(address);
      return (Number(balance) + Number(cctpBalance)).toString();
    } catch (error) {
      console.error("Error:", error);
      return "0";
    }
  };

  return {
    stake,
    stakeStatus,
    isStaking,
    isApproving,
    setIsStaking,
    bridgeProtocol,
    setBridgeProtocol,
    supportedProtocols: networkConfig.supportedProtocols,
    assetSymbol: networkConfig.assetSymbol,
    usdcBalance: networkConfig.assetSymbol === 'XRP'
      ? Math.floor(xrpBalance * 10000) / 10000
      : networkConfig.chainFamily === 'solana'
        ? solanaUsdcBalance
        : (usdcBalance ? Number(usdcBalance) / (decimals === 6 ? 10 ** 6 : 10 ** 18) : 0),
    linkBalance: networkConfig.chainFamily === 'solana'
      ? solanaLinkBalance
      : (linkBalance ? Number(linkBalance) / 10 ** 18 : 0),
    solanaWsolBalance,
    solanaCcipFeeToken,
    setSolanaCcipFeeToken,
    solanaCcipFeeEst,
    setSolanaCcipFeeEst,
    estimateCcipFee,
    hasAllowance: bridgeProtocol === 'Axelar ITS'
      ? true
      : networkConfig.chainFamily === 'solana'
        ? true
      : (bridgeProtocol === 'CCIP'
        ? (usdcAllowance && linkAllowance
          ? (usdcAllowance >= toUnits(stakeAmount, decimals) && linkAllowance >= BigInt(10 * 10 ** 18))
          : false)
        : (usdcAllowance
          ? usdcAllowance >= toUnits(stakeAmount, decimals)
          : false)),
    checkAllowance,
    getStakedBalance,
    stakeManager,
    setStakeAmount,
    xrpBalance,
    stakingNFTs,
    stakingOffers,
    solanaStakingNFTs,
    mintSolanaReceiptNFT
  };
}
