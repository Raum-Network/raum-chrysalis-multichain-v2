import { useState, useEffect } from 'react';
import { useWallet } from '../lib/walletConnect';
import { useWriteContract, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import stakedUserBalance from '../lib/sepoliaContract';
import { decodeAccountID } from "xrpl";
import { ethers } from 'ethers';
import { reserveNftId, mintStakingNFT } from '../lib/xrplMinter';

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

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function evmAddressToAscii(address: string): string {
  const cleanAddress = address.replace('0x', '').toLowerCase()
  return Array.from(cleanAddress)
    .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
}

export function useStaking() {
  const { address, networkConfig, chainId } = useWallet();
  const [stakeStatus, setStakeStatus] = useState<StakeStatus | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [bridgeProtocol, setBridgeProtocol] = useState<"CCIP" | "CCTP" | "Axelar ITS">("CCIP");
  const [isApproving, setIsApproving] = useState(false);
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [xrpBalance, setXrpBalance] = useState<number>(0);
  const [stakingNFTs, setStakingNFTs] = useState<{ id: string, receipt: StakingReceipt }[]>([]);
  const [stakingOffers, setStakingOffers] = useState<{ id: string, receipt: StakingReceipt, offerIndex: string }[]>([]);

  const { writeContractAsync } = useWriteContract();

  // Get contract addresses from network config
  const USDC_ADDRESS = networkConfig.contracts.usdc as `0x${string}`;
  const LINK_ADDRESS = networkConfig.contracts.fees as `0x${string}`;
  const STAKE_CONTRACT_ADDRESS = networkConfig.contracts.ccip as `0x${string}`;
  const STAKE_CCTP_CONTRACT_ADDRESS = networkConfig.contracts.cctp as `0x${string}`;

  // Update StakeManager and SepoliaContract with current chainId
  stakeManager.updateChainId(chainId);
  stakedUserBalance.updateChainId(chainId);

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });

  // Read allowances
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address as `0x${string}`, bridgeProtocol === 'CCIP' ? STAKE_CONTRACT_ADDRESS : STAKE_CCTP_CONTRACT_ADDRESS],
  });

  // ── Single consolidated XRPL fetch: balance + NFTs + offers in one connection ──
  useEffect(() => {
    let active = true;

    const fetchAllXrplData = async () => {
      if (!address || networkConfig.name !== 'Ripple Testnet') {
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

        // Fire all 3 requests in parallel over the same WebSocket
        const [balanceRes, userNftsRes, minterOffersRes] = await Promise.all([
          client.request({ command: 'account_info', account: address, ledger_index: 'validated' }),
          client.request({ command: 'account_nfts', account: address, ledger_index: 'validated' }),
          client.request({ command: 'account_objects', account: minterAddress, type: 'nft_offer', ledger_index: 'validated' }),
        ]);

        await client.disconnect();
        if (!active) return;

        // 1) XRP Balance
        const balanceInXrp = Number(balanceRes.result.account_data.Balance) / 1_000_000;
        setXrpBalance(balanceInXrp);

        // 2) User's owned NFTs (already accepted receipts)
        const nfts = userNftsRes.result?.account_nfts;
        if (nfts && Array.isArray(nfts)) {
          const receipts: { id: string, receipt: StakingReceipt }[] = [];
          for (const nft of nfts) {
            if (nft.URI) {
              try {
                const decodedRaw = Buffer.from(nft.URI, "hex").toString("utf8");
                if (decodedRaw.startsWith("data:application/json,")) {
                  const jsonString = decodedRaw.slice("data:application/json,".length);
                  const parsed = JSON.parse(jsonString);
                  if (parsed.type === "stake" || parsed.v === "1") {
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
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
          receipts.sort((a, b) => (b.receipt.stakedAt || 0) - (a.receipt.stakedAt || 0));
          setStakingNFTs(receipts);
        } else {
          setStakingNFTs([]);
        }

        // 3) Pending sell offers directed to this user — decode metadata client-side
        //    We need the minter's NFTs to look up URIs. Fetch only if there are offers for us.
        const allOffers = minterOffersRes.result?.account_objects || [];
        const userOffers = allOffers.filter((obj: any) => obj.Destination === address);

        if (userOffers.length > 0) {
          // Fetch minter's NFTs to decode URIs client-side (avoid per-offer HTTP round-trips)
          const client2 = new Client(clientUrl, { connectionTimeout: 20000 });
          await client2.connect();
          const minterNftsRes = await client2.request({
            command: 'account_nfts', account: minterAddress, ledger_index: 'validated'
          });
          await client2.disconnect();

          const minterNfts = minterNftsRes.result?.account_nfts || [];
          // Build a lookup map: NFTokenID -> decoded receipt
          const nftUriMap = new Map<string, StakingReceipt>();
          for (const mnft of minterNfts) {
            if (mnft.URI) {
              try {
                const raw = Buffer.from(mnft.URI, "hex").toString("utf8");
                if (raw.startsWith("data:application/json,")) {
                  const parsed = JSON.parse(raw.slice("data:application/json,".length));
                  const receipt: StakingReceipt = {
                    v: parsed.v || "1", type: parsed.type || "stake",
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
                }
              } catch (e) { /* skip */ }
            }
          }

          const fetchedOffers: { id: string, receipt: StakingReceipt, offerIndex: string }[] = [];
          for (const offer of userOffers) {
            const nftId = (offer as any).NFTokenID;
            const receipt = nftUriMap.get(nftId);
            if (receipt) {
              fetchedOffers.push({ id: nftId, offerIndex: (offer as any).index, receipt });
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
    }
  }, [address, networkConfig.name]);

  const { data: linkBalance } = useReadContract({
    address: LINK_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });


  const { data: linkAllowance, refetch: refetchLinkAllowance } = useReadContract({
    address: LINK_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address as `0x${string}`, STAKE_CONTRACT_ADDRESS],
  });

  const approveToken = async (amount: number) => {
    if (!address) throw new Error('Wallet not connected');
    setIsApproving(true);

    try {
      const amountInWei = BigInt(amount * (networkConfig.contracts.decimal === 6 ? 10 ** 6 : 10 ** 18));

      // Approve USDC
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [bridgeProtocol === 'CCIP' ? STAKE_CONTRACT_ADDRESS : STAKE_CCTP_CONTRACT_ADDRESS, amountInWei],
      });
      await refetchUsdcAllowance();

      // For CCIP, also approve LINK
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

    // Axelar ITS on XRP doesn't require ERC20 allowances
    if (bridgeProtocol === 'Axelar ITS') return true;

    const amountInWei = BigInt(amount * (networkConfig.contracts.decimal === 6 ? 10 ** 6 : 10 ** 18));
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

      if (bridgeProtocol === 'Axelar ITS' && networkConfig.name === 'Ripple Testnet') {
        const amountInDrops = Math.round((Number(amount)) * 1_000_000).toString()
        const depositAddress = networkConfig.contracts.destination;
        const evmAddress = networkConfig.contracts.cctpDestinationCaller;

        const cleanEvmAddress = (evmAddress || "").replace('0x', '').toLowerCase()
        const addressInAscii = evmAddressToAscii(cleanEvmAddress)

        const accountIDBytes = decodeAccountID(address);
        const xrplToEVMAddress = `0x${Buffer.from(accountIDBytes).toString("hex")}`;

        let axelarGasDrops = "2000000"; // Fallback gas drops
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
              // We set a high gas limit (e.g. 500k) to ensure complex Sepolia smart contracts execute successfully.
              gasLimit: 500000,
              gasMultiplier: "auto",
              showDetailedFees: true
            })
          });
          console.log(feeRes, "fee")
          const feeData = await feeRes.json();
          if (feeData && feeData.totalFee && !isNaN(Number(feeData.totalFee))) {
            // feeData.totalFee is strictly the cross-chain execution amount calculated in XRP Drops (6 decimals)
            axelarGasDrops = feeData.totalFee.toString();
            console.log(`[Staking] 🌉 Axelar ITS Estimated Fee: ${Number(axelarGasDrops) / 1_000_000} XRP`);
            console.log(`[Staking] 📊 Detailed Fee Breakdown:`, feeData.details);
          }
        } catch (e) {
          console.error("Axelar ITS fee estimate failed, using fallback", e);
        }

        // --- PRE-COMPUTE NFT TOKEN ID ---
        let reservedSequence: number | undefined;
        let deterministicNfTokenId: string | undefined;
        try {
          const reserveData = await reserveNftId();
          reservedSequence = reserveData.reservedSequence;
          deterministicNfTokenId = reserveData.nfTokenID;
          console.log(`[Staking] Reserved NFT ID: ${deterministicNfTokenId} (Seq: ${reservedSequence})`);
        } catch (e) {
          console.error("NFT Pre-computation failed:", e);
          throw new Error("Could not deterministically calculate the staking NFT ID.");
        }
        // --------------------------------

        const coder = ethers.AbiCoder.defaultAbiCoder()
        const encodedPayload = coder.encode(
          ["address", "string"],
          [xrplToEVMAddress, deterministicNfTokenId || ""]
        );

        console.log("deterministicNfTokenId", deterministicNfTokenId);

        const memos = [
          { Memo: { MemoType: toHex("type"), MemoData: toHex("interchain_transfer") } },
          { Memo: { MemoType: toHex("destination_address"), MemoData: addressInAscii } },
          { Memo: { MemoType: toHex("destination_chain"), MemoData: toHex("ethereum-sepolia") } },
          { Memo: { MemoType: toHex("gas_fee_amount"), MemoData: toHex(axelarGasDrops) } },
          { Memo: { MemoType: toHex("payload"), MemoData: encodedPayload.slice(2) } }
        ]

        const payment = {
          TransactionType: "Payment",
          Account: address,
          Destination: depositAddress,
          Amount: amountInDrops,
          Memos: memos,
        }

        const crossmarkSdk = window.xrpl?.crossmark || window.crossmark;
        if (!crossmarkSdk) throw new Error("Crossmark extension not found");

        const releaseSequenceLock = () => {
          // No longer needed — sequence lock was server-side only
        };

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
        } catch (sdkError: any) {
          console.error("SDK Error:", sdkError);
          releaseSequenceLock();
          throw new Error("User rejected the request or transaction failed");
        }

        console.log(result, "result")

        const hash = result?.response?.data?.resp?.result?.hash ||
          result?.response?.data?.resp?.result?.tx_json?.hash ||
          result?.response?.data?.hash ||
          result?.hash;

        console.log(hash, "hash")

        if (hash) {
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
            sourceNetworkName: 'Ripple Testnet',
            destNetworkName: 'Sepolia',
            origin: address
          }, setStakeStatus);

          let hasMinted = false;

          // Capture the pre-execution stETH balance to calculate the exact mint amount
          const preExecutionBalance = await getStakedBalance();

          stakeManager.startPollingAxelarStatus(hash, Date.now(), async (status) => {
            setStakeStatus(status);

            if (status.status === 'SUCCESS' && !hasMinted) {
              hasMinted = true; // Block subsequent executions
              console.log("Axelar ITS transaction succeeded. Calculating stETH minted...");

              // Add a slight delay to ensure the Sepolia RPC reflects the executed state
              await new Promise(resolve => setTimeout(resolve, 3000));
              const postExecutionBalance = await getStakedBalance();
              const mintedStETH = Math.max(0, Number(postExecutionBalance) - Number(preExecutionBalance)).toFixed(6);

              console.log(`[Staking] 📈 Minted stETH: ${mintedStETH}`);

              console.log("body", {
                stakerAddress: address,
                stakedAmount: amount.toString(),
                stakedToken: 'XRP',
                stakingPool: 'Raum LST Axelar ITS',
                stakingPeriodDays: 0,
                apy: apy || "4.8",
                confirmationTxHash: hash,
                reservedSequence: reservedSequence,
                mintedStETH: mintedStETH.toString()
              });

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
                .then(data => {
                  console.log('Staking NFT Mint Response:', data);
                  setIsStaking(false);
                })
                .catch(err => {
                  console.error('Failed to trigger Staking NFT Mint:', err);
                  setIsStaking(false);
                });
            }
          });
        } else if (result?.response?.data?.error || result?.error) {
          releaseSequenceLock();
          throw new Error(result?.response?.data?.error || result?.error || "Transaction was rejected or failed");
        } else {
          releaseSequenceLock();
          throw new Error("Transaction hash not returned");
        }
        return;
      }

      const hasAllowance = await checkAllowance(amount);

      if (!hasAllowance) {
        await approveToken(amount);
      }


      const stakeAmountInWei = amount * (networkConfig.contracts.decimal === 6 ? 10 ** 6 : 10 ** 18);

      if (bridgeProtocol === 'CCIP') {
        await stakeManager.stake(
          "16015286601757825753",
          networkConfig.contracts.destination as `0x${string}`,
          stakeAmountInWei,
          "999999",
          writeContractAsync,
          () => { },
          setStakeStatus
        );
      } else {
        const cctpDestinationCaller = networkConfig.contracts.cctpDestinationCaller;
        await stakeManager.stakeCCTP(
          stakeAmountInWei,
          0,
          `0x000000000000000000000000${cctpDestinationCaller}`,
          USDC_ADDRESS,
          `0x000000000000000000000000${cctpDestinationCaller}`,
          address,
          writeContractAsync,
          () => { },
          setStakeStatus
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
    try {
      const balance = await stakedUserBalance.getBalance(address);
      const cctpBalance = await stakedUserBalance.getBalanceCCTP(address);
      return (Number(balance) + Number(cctpBalance)).toString();
    } catch (error) {
      console.error("Error:", error);
      return "0";
    }
  };

  // Prevent CCTP for base-sepolia and lisk-sepolia
  if ((networkConfig.name === 'Base Sepolia' || networkConfig.name === 'Lisk Sepolia') && bridgeProtocol === 'CCTP') {
    setBridgeProtocol('CCIP');
  }

  if (networkConfig.name === 'Ripple Testnet' && bridgeProtocol !== 'Axelar ITS') {
    setBridgeProtocol('Axelar ITS');
  } else if (networkConfig.name !== 'Ripple Testnet' && bridgeProtocol === 'Axelar ITS') {
    setBridgeProtocol('CCIP');
  }

  return {
    stake,
    stakeStatus,
    isStaking,
    isApproving,
    setIsStaking,
    bridgeProtocol,
    setBridgeProtocol,
    usdcBalance: networkConfig.name === 'Ripple Testnet' ? Math.floor(xrpBalance * 10000) / 10000 : (usdcBalance ? Number(usdcBalance) / (networkConfig.contracts.decimal === 6 ? 10 ** 6 : 10 ** 18) : 0),
    linkBalance: linkBalance ? Number(linkBalance) / 10 ** 18 : 0,
    hasAllowance: bridgeProtocol === 'Axelar ITS' ? true : (bridgeProtocol === 'CCIP'
      ? (usdcAllowance && linkAllowance
        ? (usdcAllowance >= BigInt(stakeAmount * (networkConfig.contracts.decimal === 6 ? 10 ** 6 : 10 ** 18)) && linkAllowance >= BigInt(10 * 10 ** 18))
        : false)
      : (usdcAllowance
        ? usdcAllowance >= BigInt(stakeAmount * (networkConfig.contracts.decimal === 6 ? 10 ** 6 : 10 ** 18))
        : false)),
    checkAllowance,
    getStakedBalance,
    stakeManager,
    setStakeAmount,
    xrpBalance,
    stakingNFTs,
    stakingOffers
  };
}