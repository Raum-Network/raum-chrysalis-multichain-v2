import { useState, useEffect, useRef } from "react";
import { Bot, Send, ShieldCheck } from "lucide-react";
import {
  concatHex,
  createPublicClient,
  erc20Abi,
  formatEther,
  http,
  keccak256,
  pad,
  parseAbiItem,
  parseUnits,
  toHex,
} from "viem";
import { useWallet } from "../lib/walletConnect";
import { useStaking } from "../hooks/useStaking";
import stakeManager, { StakeStatus } from "../lib/stakeManager";
import { useTheme } from "../context/ThemeContext";
import { AgentPlan, planAgentCommand } from "../services/agentCommand";
import stakeABI from "../lib/abi/ChrysalisSender.json";
import stakeCCTPABI from "../lib/abi/ChrysalisSenderCCTP.json";
import { normalizeEvmAddress } from "../lib/networkSupport";
import type { MascotCue } from "../lib/mascot";

const extractWalletError = (error: unknown): string => {
  if (!error) return "Unknown error.";

  const rawMsg =
    ((error as any)?.shortMessage as string) ||
    ((error as any)?.details as string) ||
    ((error as any)?.info?.error?.message as string) ||
    (error instanceof Error ? error.message : "") ||
    "";

  const patterns: [RegExp, string][] = [
    [/user\s+rejected/i, "User rejected the transaction in wallet."],
    [/ACTION_REJECTED/i, "User rejected the transaction in wallet."],
    [/User\s+denied/i, "User denied the transaction in wallet."],
    [/insufficient\s+funds/i, "Insufficient funds for gas or value."],
    [/execution\s+reverted/i, "Transaction reverted by the contract."],
    [/nonce.*too\s+low/i, "Nonce too low. Submit again."],
    [/replacement.*underpriced/i, "Replacement fee too low."],
    [/chain\s+mismatch/i, "Network mismatch. Switch to the correct chain."],
  ];

  for (const [re, replacement] of patterns) {
    if (re.test(rawMsg)) return replacement;
  }

  return rawMsg || (error instanceof Error ? error.message : "Unknown error.");
};

interface Log {
  message: string;
  type: "success" | "info" | "error" | "warning" | "command" | "loading";
  timestamp: Date;
}

interface TerminalProps {
  logs?: Log[];
  interactive?: boolean;
  className?: string;
  onListeningChange?: (listening: boolean) => void;
  onMascotCue?: (cue: MascotCue) => void;
}

const Terminal = ({
  logs = [],
  interactive = false,
  className = "",
  onListeningChange,
  onMascotCue,
}: TerminalProps) => {
  const [allLogs, setAllLogs] = useState<Log[]>(logs);
  const [command, setCommand] = useState("");
  const [stakeState, setStakeState] = useState<"idle" | "protocol" | "amount">(
    "idle",
  );
  const [selectedProtocol, setSelectedProtocol] = useState<
    "CCIP" | "CCTP" | "Axelar ITS" | null
  >(null);
  const [pendingPlan, setPendingPlan] = useState<AgentPlan | null>(null);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const {
    address,
    isConnected,
    networkConfig,
    connect,
    disconnect,
    switchNetwork,
    getFormattedBalance,
  } = useWallet();
  const {
    stake,
    bridgeProtocol,
    setBridgeProtocol,
    usdcBalance,
    linkBalance,
    supportedProtocols,
    assetSymbol,
  } = useStaking();

  const extractAmount = (rawCommand: string) => {
    const match = rawCommand.match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  };

  const toBytes32Address = (value: string): `0x${string}` => {
    const normalized = normalizeEvmAddress(value);
    return `0x000000000000000000000000${normalized.slice(2)}` as `0x${string}`;
  };

  const encodeUint256 = (value: bigint | number) => toHex(value, { size: 32 });

  const mappingSlot = (key: `0x${string}`, slotIndex: number) =>
    keccak256(concatHex([pad(key), encodeUint256(slotIndex)]));

  const nestedAllowanceSlot = (
    owner: `0x${string}`,
    spender: `0x${string}`,
    slotIndex: number,
  ) => {
    const outer = keccak256(concatHex([pad(owner), encodeUint256(slotIndex)]));
    return keccak256(concatHex([pad(spender), outer]));
  };

  const discoverBalanceSlot = async (
    client: ReturnType<typeof createPublicClient>,
    tokenAddress: `0x${string}`,
    owner: `0x${string}`,
    targetValue: bigint,
  ) => {
    for (let slotIndex = 0; slotIndex <= 20; slotIndex += 1) {
      const slot = mappingSlot(owner, slotIndex);
      try {
        const result = await client.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
          stateOverride: [
            {
              address: tokenAddress,
              stateDiff: [{ slot, value: encodeUint256(targetValue) }],
            },
          ],
        });
        if (result === targetValue) return slotIndex;
      } catch {
        continue;
      }
    }
    return null;
  };

  const discoverAllowanceSlot = async (
    client: ReturnType<typeof createPublicClient>,
    tokenAddress: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
    targetValue: bigint,
  ) => {
    for (let slotIndex = 0; slotIndex <= 20; slotIndex += 1) {
      const slot = nestedAllowanceSlot(owner, spender, slotIndex);
      try {
        const result = await client.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner, spender],
          stateOverride: [
            {
              address: tokenAddress,
              stateDiff: [{ slot, value: encodeUint256(targetValue) }],
            },
          ],
        });
        if (result === targetValue) return slotIndex;
      } catch {
        continue;
      }
    }
    return null;
  };

  const estimateRouteGasFromRecentCctpSender = async (
    client: ReturnType<typeof createPublicClient>,
    amountInUnits: bigint,
    tokenAddress: `0x${string}`,
  ) => {
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock > 20000n ? latestBlock - 20000n : 0n;
    const logs = await client.getLogs({
      address: normalizeEvmAddress(
        networkConfig.contracts.cctp,
      ) as `0x${string}`,
      event: parseAbiItem(
        "event DepositForBurn(address indexed sender, uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller)",
      ),
      fromBlock,
      toBlock: latestBlock,
    });

    const recentSenders = Array.from(
      new Set(
        [...logs]
          .reverse()
          .map((log) => log.args.sender)
          .filter((sender): sender is `0x${string}` => Boolean(sender)),
      ),
    ).slice(0, 8);

    for (const sender of recentSenders) {
      try {
        const gas = await client.estimateContractGas({
          account: sender,
          address: normalizeEvmAddress(
            networkConfig.contracts.cctp,
          ) as `0x${string}`,
          abi: stakeCCTPABI,
          functionName: "depositForBurnWithCaller",
          args: [
            amountInUnits,
            networkConfig.destinationDomain ?? 0,
            toBytes32Address(
              networkConfig.contracts.cctpDestinationCaller ||
                networkConfig.contracts.destination ||
                "",
            ),
            tokenAddress,
            toBytes32Address(
              networkConfig.contracts.cctpDestinationCaller ||
                networkConfig.contracts.destination ||
                "",
            ),
          ],
        });
        return { gas, sender };
      } catch {
        continue;
      }
    }

    throw new Error(
      "Could not find a recent funded CCTP sender to simulate the stake leg.",
    );
  };

  const estimateStakeFee = async (
    planOrCommand: AgentPlan | string,
  ): Promise<Log[]> => {
    const now = new Date();
    const emit = (message: string, type: Log["type"] = "info"): Log => ({
      message,
      type,
      timestamp: now,
    });
    const amount =
      typeof planOrCommand === "string"
        ? extractAmount(planOrCommand)
        : planOrCommand.amount;
    const protocol =
      typeof planOrCommand === "string"
        ? planOrCommand.toLowerCase().includes("ccip")
          ? "CCIP"
          : planOrCommand.toLowerCase().includes("cctp") ||
              supportedProtocols.includes("CCTP")
            ? "CCTP"
            : supportedProtocols[0]
        : planOrCommand.protocol || supportedProtocols[0];

    if (!amount || amount <= 0) {
      return [
        emit(
          `Tell me the amount to estimate, for example: fees for staking 10 ${assetSymbol}.`,
          "warning",
        ),
      ];
    }

    if (!isConnected || !address || !address.startsWith("0x")) {
      return [
        emit(
          "Connect an EVM wallet first so I can estimate gas from your account.",
          "warning",
        ),
      ];
    }

    if (!protocol || !supportedProtocols.includes(protocol)) {
      return [
        emit(
          `No fee estimate route is available on ${networkConfig.name}.`,
          "error",
        ),
      ];
    }

    try {
      const decimals = networkConfig.contracts.decimal || 6;
      const amountInUnits = parseUnits(amount.toString(), decimals);
      const client = createPublicClient({
        chain: {
          id: networkConfig.chainId,
          name: networkConfig.name,
          network: networkConfig.name.toLowerCase().replace(/\s+/g, "-"),
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: {
            default: { http: [networkConfig.rpcUrl] },
            public: { http: [networkConfig.publicRpc || networkConfig.rpcUrl] },
          },
        },
        transport: http(networkConfig.publicRpc || networkConfig.rpcUrl),
      });

      const gasPrice = await client.getGasPrice();
      const account = address as `0x${string}`;
      const tokenAddress = normalizeEvmAddress(
        networkConfig.contracts.usdc,
      ) as `0x${string}`;
      const spenderAddress = normalizeEvmAddress(
        protocol === "CCTP"
          ? networkConfig.contracts.cctp
          : networkConfig.contracts.ccip,
      ) as `0x${string}`;
      const warnings: string[] = [];
      const currentAllowance = await client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, spenderAddress],
      });
      const currentBalance = await client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account],
      });

      const approvalGas =
        currentAllowance < amountInUnits
          ? await client.estimateContractGas({
              account,
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "approve",
              args: [spenderAddress, amountInUnits],
            })
          : 0n;

      if (approvalGas > 0n) {
        warnings.push(
          "USDC allowance is below the requested amount, so the estimate includes an approval transaction.",
        );
      }

      const requiredBalance =
        currentBalance >= amountInUnits ? currentBalance : amountInUnits;
      const allowanceSlotIndex =
        currentAllowance >= amountInUnits
          ? null
          : await discoverAllowanceSlot(
              client,
              tokenAddress,
              account,
              spenderAddress,
              amountInUnits,
            );
      const balanceSlotIndex =
        currentBalance >= amountInUnits
          ? null
          : await discoverBalanceSlot(
              client,
              tokenAddress,
              account,
              requiredBalance,
            );

      if (currentAllowance < amountInUnits && allowanceSlotIndex === null) {
        throw new Error(
          "Could not discover the USDC allowance storage slot for real stake simulation.",
        );
      }
      if (currentBalance < amountInUnits && balanceSlotIndex === null) {
        throw new Error(
          "Could not discover the USDC balance storage slot for real stake simulation.",
        );
      }

      const stateDiff = [
        allowanceSlotIndex !== null
          ? {
              slot: nestedAllowanceSlot(
                account,
                spenderAddress,
                allowanceSlotIndex,
              ),
              value: encodeUint256(amountInUnits),
            }
          : null,
        balanceSlotIndex !== null
          ? {
              slot: mappingSlot(account, balanceSlotIndex),
              value: encodeUint256(requiredBalance),
            }
          : null,
      ].filter(Boolean) as { slot: `0x${string}`; value: `0x${string}` }[];

      const stateOverride =
        stateDiff.length > 0
          ? [{ address: tokenAddress, stateDiff }]
          : undefined;

      let routeGas: bigint;
      let routeSender: `0x${string}` | null = null;

      if (protocol === "CCTP") {
        try {
          routeGas = await client.estimateContractGas({
            account,
            address: normalizeEvmAddress(
              networkConfig.contracts.cctp,
            ) as `0x${string}`,
            abi: stakeCCTPABI,
            functionName: "depositForBurnWithCaller",
            args: [
              amountInUnits,
              networkConfig.destinationDomain ?? 0,
              toBytes32Address(
                networkConfig.contracts.cctpDestinationCaller ||
                  networkConfig.contracts.destination ||
                  "",
              ),
              tokenAddress,
              toBytes32Address(
                networkConfig.contracts.cctpDestinationCaller ||
                  networkConfig.contracts.destination ||
                  "",
              ),
            ],
            stateOverride,
          });
        } catch {
          const simulated = await estimateRouteGasFromRecentCctpSender(
            client,
            amountInUnits,
            tokenAddress,
          );
          routeGas = simulated.gas;
          routeSender = simulated.sender;
          warnings.push(
            `Stake leg was estimated using recent Arc sender ${simulated.sender} because your wallet state blocks direct CCTP simulation.`,
          );
        }
      } else {
        routeGas = await client.estimateContractGas({
          account,
          address: normalizeEvmAddress(
            networkConfig.contracts.ccip,
          ) as `0x${string}`,
          abi: stakeABI,
          functionName: "handleStakingAction",
          args: [
            "16015286601757825753",
            normalizeEvmAddress(networkConfig.contracts.destination || ""),
            amountInUnits,
            "999999",
          ],
          stateOverride,
        });
      }

      const gas = approvalGas + routeGas;
      const nativeFeeWei = gas * gasPrice;
      const bufferedWei = nativeFeeWei + nativeFeeWei / 5n;
      const nativeSymbol =
        networkConfig.chainId === 5042002
          ? "USDC"
          : networkConfig.chainId === 98867
            ? "PLUME"
            : "ETH";
      const lines = [
        emit(
          `Fee estimate for staking ${amount} ${assetSymbol} on ${networkConfig.name} via ${protocol}:`,
          "success",
        ),
        emit(`  approval gas: ${approvalGas.toString()}`),
        emit(`  route gas: ${routeGas.toString()}`),
        emit(`  total estimated gas units: ${gas.toString()}`),
        emit(`  current gas price: ${formatEther(gasPrice)} ${nativeSymbol}`),
        emit(
          `  estimated source-chain gas: ${formatEther(nativeFeeWei)} ${nativeSymbol}`,
        ),
        emit(
          `  suggested wallet buffer: ${formatEther(bufferedWei)} ${nativeSymbol}`,
        ),
      ];

      if (routeSender) {
        lines.push(emit(`  simulation sender: ${routeSender}`, "info"));
      }

      warnings.forEach((warning) =>
        lines.push(emit(`  ${warning}`, "warning")),
      );

      if (protocol === "CCIP") {
        lines.push(
          emit(
            "  CCIP also requires LINK fee allowance. This app checks for a 10 LINK buffer before execution.",
            "warning",
          ),
        );
      } else {
        lines.push(
          emit(
            "  CCTP has no LINK fee requirement in this flow; you still pay source-chain gas.",
            "info",
          ),
        );
      }

      lines.push(
        emit(
          "No transaction prepared. Type a stake command separately when ready.",
          "warning",
        ),
      );
      return lines;
    } catch (error) {
      return [
        emit(
          `Could not estimate fees: ${error instanceof Error ? error.message : "Unknown estimation error"}`,
          "error",
        ),
        emit(
          "No transaction prepared. Fee estimation failed before execution.",
          "warning",
        ),
      ];
    }
  };

  const localCommandLines = (rawCommand: string): Log[] | null => {
    const now = new Date();
    const normalizedCommand = rawCommand.trim().toLowerCase();
    const emit = (lines: string[], type: Log["type"] = "info") =>
      lines.map((message): Log => ({ message, type, timestamp: now }));

    switch (normalizedCommand) {
      case "help":
        return emit([
          "Available commands:",
          "  help       list all commands",
          "  about      what Chrysalis does",
          "  skills     protocol and agent stack",
          "  projects   featured Chrysalis flows",
          "  contact    project links and feedback",
          "  ls         directory listing",
          "  whoami     current wallet/session",
          "  wallet     wallet connection status",
          "  connect    connect wallet",
          "  disconnect disconnect wallet",
          "  network arc switch to Arc Testnet",
          "  date       local date and time",
          "  clear      clear terminal output",
          "  routes     show supported bridge routes",
          "  balance    show asset balance",
          "  stake 10 USDC on Arc",
        ]);
      case "about":
        return emit([
          "Chrysalis is an agentic cross-chain liquid staking terminal.",
          "Type a natural-language intent, let the agents plan the route, then confirm before any wallet execution.",
          `Current context: ${networkConfig.name} / ${supportedProtocols.join(", ") || "no routes configured"}.`,
        ]);
      case "skills":
        return emit(
          [
            "Agent stack:",
            "  Intent parser      [█████████░] 92%",
            "  Route planner      [████████░░] 84%",
            "  Safety guard       [██████████] 100%",
            "  Transaction watch  [███████░░░] 72%",
            "Protocol stack:",
            `  ${supportedProtocols.join(" / ") || "No protocols available on this network"}`,
            `  Asset: ${assetSymbol}`,
          ],
          "success",
        );
      case "projects":
        return emit([
          "Featured flows:",
          "  /arc-mission       connect wallet, inspect route, stake testnet USDC",
          "  /route-engine      compare CCTP, CCIP, and Axelar capabilities",
          "  /tx-watch          follow source tx, attestation, destination settlement",
          "  /safety-gate       require explicit confirm before wallet signing",
        ]);
      case "contact":
        return emit([
          "Contact / links:",
          "  Feedback: https://faucet.raum.network",
          "  Terminal: Chrysalis Arc agent CLI",
          '  Tip: type "stake 10 USDC on Arc" to start a planned flow',
        ]);
      case "ls":
        return emit([
          "drwxr-xr-x  agents/",
          "drwxr-xr-x  routes/",
          "drwxr-xr-x  wallet/",
          "drwxr-xr-x  transactions/",
          "-rw-r--r--  README.arc",
          "-rw-r--r--  mission.arc",
        ]);
      case "whoami":
      case "wallet":
      case "wallet status":
        return emit(
          [
            `wallet: ${isConnected && address ? address : "not connected"}`,
            `network: ${networkConfig.name}`,
            `asset: ${usdcBalance.toFixed(4)} ${assetSymbol}`,
            `routes: ${supportedProtocols.join(", ") || "none"}`,
          ],
          isConnected ? "success" : "warning",
        );
      case "date":
        return emit([new Date().toString()]);
      case "routes":
        return emit(
          [
            `Available routes on ${networkConfig.name}: ${supportedProtocols.join(", ") || "none configured"}`,
          ],
          "success",
        );
      case "balance":
        return emit(
          [
            `Current ${assetSymbol} balance: ${usdcBalance.toFixed(4)} ${assetSymbol}`,
          ],
          "success",
        );
      default:
        return null;
    }
  };

  const isConnectCommand = (rawCommand: string) => {
    const input = rawCommand.trim().toLowerCase();
    return [
      "connect",
      "connect wallet",
      "connect my wallet",
      "wallet connect",
      "login",
      "sign in",
      "signin",
    ].includes(input);
  };

  const isDisconnectCommand = (rawCommand: string) => {
    const input = rawCommand.trim().toLowerCase();
    return [
      "disconnect",
      "disconnect wallet",
      "disconnect my wallet",
      "wallet disconnect",
      "logout",
      "log out",
      "sign out",
      "signout",
    ].includes(input);
  };

  const isArcNetworkCommand = (rawCommand: string) => {
    const input = rawCommand.trim().toLowerCase();
    return (
      /(switch|change|set|use).*(network|chain).*(arc|arc testnet)/.test(
        input,
      ) ||
      /(network|chain).*(arc|arc testnet)/.test(input) ||
      [
        "arc",
        "arc testnet",
        "network arc",
        "switch arc",
        "switch to arc",
      ].includes(input)
    );
  };

  const handleArcNetworkCommand = async (newLogs: Log[]) => {
    setAllLogs([
      ...newLogs,
      {
        message: "Switching wallet to Arc Testnet...",
        type: "loading",
        timestamp: new Date(),
      },
    ]);

    try {
      await switchNetwork("arc-testnet");
      setAllLogs([
        ...newLogs,
        {
          message: "Network set to Arc Testnet.",
          type: "success",
          timestamp: new Date(),
        },
        {
          message: "Only Arc Testnet is enabled in this terminal.",
          type: "info",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      setAllLogs([
        ...newLogs,
        {
          message: `Network switch failed: ${extractWalletError(error)}`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleWalletConnectCommand = async (newLogs: Log[]) => {
    if (isConnected) {
      setAllLogs([
        ...newLogs,
        {
          message: `Wallet already connected: ${address || "active session"}`,
          type: "success",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setAllLogs([
      ...newLogs,
      {
        message: "Opening wallet connection from terminal...",
        type: "loading",
        timestamp: new Date(),
      },
    ]);

    try {
      const result = await connect();
      setAllLogs([
        ...newLogs,
        {
          message: `Wallet connection requested${result?.address ? `: ${result.address}` : "."}`,
          type: "success",
          timestamp: new Date(),
        },
        {
          message: "Approve the wallet prompt if it is still open.",
          type: "info",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      setAllLogs([
        ...newLogs,
        {
          message: `Wallet connection failed: ${extractWalletError(error)}`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleWalletDisconnectCommand = async (newLogs: Log[]) => {
    if (!isConnected) {
      setAllLogs([
        ...newLogs,
        {
          message: "No wallet is connected.",
          type: "warning",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setAllLogs([
      ...newLogs,
      {
        message: "Disconnecting wallet session...",
        type: "loading",
        timestamp: new Date(),
      },
    ]);

    try {
      await disconnect();
      setPendingPlan(null);
      setStakeState("idle");
      setSelectedProtocol(null);
      setAllLogs([
        ...newLogs,
        {
          message: "Wallet disconnected.",
          type: "success",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      setAllLogs([
        ...newLogs,
        {
          message: `Wallet disconnect failed: ${extractWalletError(error)}`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
    }
  };

  useEffect(() => {
    // Auto-scroll to bottom when logs update
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [allLogs]);

  const runStakePlan = async (plan: AgentPlan, existingLogs: Log[]) => {
    if (!plan.amount || plan.amount <= 0) {
      setAllLogs([
        ...existingLogs,
        {
          message: `Tell me the amount, for example: stake 10 ${assetSymbol} on Arc.`,
          type: "warning",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    if (!isConnected) {
      setAllLogs([
        ...existingLogs,
        {
          message:
            "Connect your wallet first, then I can prepare the Arc route.",
          type: "warning",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const protocol =
      plan.protocol && supportedProtocols.includes(plan.protocol)
        ? plan.protocol
        : supportedProtocols[0];

    if (!protocol) {
      setAllLogs([
        ...existingLogs,
        {
          message: `No supported protocol is configured for ${networkConfig.name}.`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    if (plan.amount > usdcBalance) {
      setAllLogs([
        ...existingLogs,
        {
          message: `Insufficient ${assetSymbol}. Balance: ${usdcBalance.toFixed(4)} ${assetSymbol}.`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    if (protocol === "CCIP" && linkBalance < 10) {
      setAllLogs([
        ...existingLogs,
        {
          message: `CCIP needs at least 10 LINK for fees. Current LINK: ${linkBalance.toFixed(2)}.`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setBridgeProtocol(protocol);
    setPendingPlan({ ...plan, protocol });
    setAllLogs([
      ...existingLogs,
      {
        message: `Safety check passed. Prepared ${plan.amount} ${assetSymbol} via ${protocol}. Type confirm to execute or cancel to abort.`,
        type: "success",
        timestamp: new Date(),
      },
    ]);
  };

  const executePendingPlan = async (existingLogs: Log[]) => {
    if (!pendingPlan?.amount) return;

    const protocol = pendingPlan.protocol || bridgeProtocol;
    try {
      setAllLogs([
        ...existingLogs,
        {
          message: `Executing ${pendingPlan.amount} ${assetSymbol} via ${protocol}...`,
          type: "loading",
          timestamp: new Date(),
        },
      ]);

      await stake(pendingPlan.amount);
      setAllLogs((prevLogs) => [
        ...prevLogs,
        {
          message: `Execution submitted for ${pendingPlan.amount} ${assetSymbol} via ${protocol}. Watching transaction status.`,
          type: "success",
          timestamp: new Date(),
        },
      ]);
      setPendingPlan(null);
    } catch (error) {
      setAllLogs((prevLogs) => [
        ...prevLogs,
        {
          message: `Execution failed: ${extractWalletError(error)}`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
      setPendingPlan(null);
    }
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedCommand = command.trim();
    if (!submittedCommand) return;

    // Add the command to logs
    const newLogs: Log[] = [
      ...allLogs,
      {
        message: `> ${submittedCommand}`,
        type: "command",
        timestamp: new Date(),
      },
    ];
    setCommand("");

    if (submittedCommand.toLowerCase() === "clear") {
      setAllLogs([]);
      return;
    }

    if (isConnectCommand(submittedCommand)) {
      await handleWalletConnectCommand(newLogs);
      return;
    }

    if (isDisconnectCommand(submittedCommand)) {
      await handleWalletDisconnectCommand(newLogs);
      return;
    }

    if (isArcNetworkCommand(submittedCommand)) {
      await handleArcNetworkCommand(newLogs);
      return;
    }

    const localLogs = localCommandLines(submittedCommand);
    if (localLogs) {
      setAllLogs([...newLogs, ...localLogs]);
      return;
    }

    if (
      pendingPlan &&
      ["confirm", "yes", "execute", "run"].includes(
        submittedCommand.toLowerCase(),
      )
    ) {
      await executePendingPlan(newLogs);
      return;
    }

    if (
      pendingPlan &&
      ["cancel", "abort", "stop"].includes(submittedCommand.toLowerCase())
    ) {
      setPendingPlan(null);
      setAllLogs([
        ...newLogs,
        {
          message: "Pending execution cancelled.",
          type: "warning",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // Handle different states of staking process
    if (stakeState === "protocol") {
      const protocol = submittedCommand.toUpperCase();
      const normalizedProtocol =
        protocol === "AXELAR" ? "AXELAR ITS" : protocol;
      const isProtocolInput = (
        value: string,
      ): value is "CCIP" | "CCTP" | "AXELAR ITS" =>
        value === "CCIP" || value === "CCTP" || value === "AXELAR ITS";
      const protocolMap = new Map([
        ["CCIP", "CCIP"],
        ["CCTP", "CCTP"],
        ["AXELAR ITS", "Axelar ITS"],
      ] as const);
      const selected = isProtocolInput(normalizedProtocol)
        ? protocolMap.get(normalizedProtocol)
        : undefined;

      if (!selected || !supportedProtocols.includes(selected)) {
        setAllLogs([
          ...newLogs,
          {
            message: `Unsupported protocol. Allowed protocols: ${supportedProtocols.join(", ")}`,
            type: "error",
            timestamp: new Date(),
          },
        ]);
        setCommand("");
        return;
      }

      setSelectedProtocol(selected);
      setBridgeProtocol(selected);
      setStakeState("amount");
      setAllLogs([
        ...newLogs,
        {
          message: `Selected protocol: ${selected}. Please enter the amount of ${assetSymbol} to stake:`,
          type: "info",
          timestamp: new Date(),
        },
      ]);
      setCommand("");
      return;
    }

    if (stakeState === "amount") {
      const inputValue = submittedCommand;

      // Check if input has more than 6 decimal places
      const parts = inputValue.split(".");
      if (parts[1] && parts[1].length > 6) {
        setAllLogs([
          ...newLogs,
          {
            message: "Amount can only have up to 6 decimal places",
            type: "error",
            timestamp: new Date(),
          },
        ]);
        setCommand("");
        return;
      }

      const amount = parseFloat(inputValue);
      if (isNaN(amount) || amount <= 0) {
        setAllLogs([
          ...newLogs,
          {
            message: "Invalid amount. Please enter a valid number:",
            type: "error",
            timestamp: new Date(),
          },
        ]);
        setCommand("");
        return;
      }

      if (amount > usdcBalance) {
        setAllLogs([
          ...newLogs,
          {
            message: `Insufficient ${assetSymbol} balance. Your current ${assetSymbol} balance is ${usdcBalance.toFixed(2)} ${assetSymbol}`,
            type: "error",
            timestamp: new Date(),
          },
        ]);
        setCommand("");
        return;
      }

      if (bridgeProtocol === "CCIP" && linkBalance < 10) {
        setAllLogs([
          ...newLogs,
          {
            message: `Insufficient LINK balance. Your current LINK balance is ${linkBalance.toFixed(2)} LINK`,
            type: "error",
            timestamp: new Date(),
          },
        ]);
        setCommand("");
        return;
      }

      try {
        const protoLabel = selectedProtocol || bridgeProtocol;
        setAllLogs([
          ...newLogs,
          {
            message: `Staking ${amount} ${assetSymbol} using ${protoLabel} protocol...`,
            type: "info",
            timestamp: new Date(),
          },
        ]);

        await stake(amount);
        setAllLogs([
          ...newLogs,
          {
            message: `Staking Completed. Staked ${amount} ${assetSymbol} using ${protoLabel} protocol...`,
            type: "success",
            timestamp: new Date(),
          },
        ]);

        // Subscribe to stake status updates
        const unsubscribe = stakeManager.subscribeToStatus(
          (status: StakeStatus) => {
            if (
              status.status === "SUCCESS" &&
              selectedProtocol === "CCTP" &&
              status.destinationTxHash
            ) {
              setAllLogs((prevLogs) => [
                ...prevLogs,
                {
                  message: `CCTP Transaction Success! Destination TX Hash: ${status.destinationTxHash}`,
                  type: "success",
                  timestamp: new Date(),
                },
              ]);
              unsubscribe();
            }
          },
        );

        setStakeState("idle");
        setSelectedProtocol(null);
      } catch (error) {
        setAllLogs([
          ...newLogs,
          {
            message: `Staking failed: ${extractWalletError(error)}`,
            type: "error",
            timestamp: new Date(),
          },
        ]);
        setStakeState("idle");
        setSelectedProtocol(null);
      }
      setCommand("");
      return;
    }

    setAllLogs([
      ...newLogs,
      {
        message: "Agent is reading command intent...",
        type: "loading",
        timestamp: new Date(),
      },
    ]);
    setIsAgentThinking(true);
    onListeningChange?.(true);

    try {
      const { plans, source, error } = await planAgentCommand(
        submittedCommand,
        {
          address,
          isConnected,
          networkName: networkConfig.name,
          chainId: networkConfig.chainId,
          explorer: networkConfig.explorer,
          supportedProtocols,
          assetSymbol,
          assetBalance: usdcBalance,
          linkBalance,
          destinationDomain: networkConfig.destinationDomain,
          sourceDomainId: networkConfig.sourceDomainId,
          contracts: networkConfig.contracts,
        },
      );

      let currentLogs: Log[] = [...newLogs];
      let pendingStakePlan: AgentPlan | null = null;
      let finalCueState: MascotCue["state"] = "answer-ready";

      for (const plan of plans) {
        currentLogs.push({
          message: plan.reply,
          type: "success",
          timestamp: new Date(),
        });
        if (plan.steps.length > 0) {
          currentLogs.push(
            ...plan.steps.map(
              (step): Log => ({
                message: `- ${step}`,
                type: "info",
                timestamp: new Date(),
              }),
            ),
          );
        }
        if (plan.warnings.length > 0) {
          currentLogs.push(
            ...plan.warnings.map(
              (warning): Log => ({
                message: `Warning: ${warning}`,
                type: "warning",
                timestamp: new Date(),
              }),
            ),
          );
        }

        if (plan.action === "stake") {
          // Only keep the first stake plan when there are multiple plans
          if (!pendingStakePlan) {
            pendingStakePlan = plan;
          } else {
            currentLogs.push({
              message: `Multiple stake commands detected. Processing the first one (${pendingStakePlan.amount || '?'} ${assetSymbol}).`,
              type: "warning",
              timestamp: new Date(),
            });
          }
        } else if (plan.action === "fees") {
          const feeLogs = await estimateStakeFee(plan);
          currentLogs = [...currentLogs, ...feeLogs];
        } else if (plan.action === "balance") {
          const balance =
            assetSymbol === "USDC"
              ? getFormattedBalance()
              : usdcBalance.toFixed(4);
          currentLogs.push({
            message: `Current ${assetSymbol} balance: ${balance} ${assetSymbol}`,
            type: "success",
            timestamp: new Date(),
          });
        } else if (plan.action === "routes") {
          currentLogs.push({
            message: `Available route agents: ${supportedProtocols.join(", ")} on ${networkConfig.name}.`,
            type: "success",
            timestamp: new Date(),
          });
          finalCueState = "bridge-cross-chain";
        } else if (plan.action === "faucet") {
          currentLogs.push({
            message: "Faucet: https://faucet.raum.network",
            type: "info",
            timestamp: new Date(),
          });
        } else if (plan.action === "help") {
          currentLogs.push({
            message: `Help: ${plan.reply}`,
            type: "info",
            timestamp: new Date(),
          });
        }
      }

      if (error && source === "fallback") {
        currentLogs.push({
          message: error,
          type: "warning",
          timestamp: new Date(),
        });
      }

      setAllLogs(currentLogs);

      if (pendingStakePlan) {
        await runStakePlan(pendingStakePlan, currentLogs);
      } else {
        onMascotCue?.({ state: finalCueState });
      }
    } catch (error) {
      setAllLogs([
        ...newLogs,
        {
          message: `Agent failed: ${extractWalletError(error)}`,
          type: "error",
          timestamp: new Date(),
        },
      ]);
      onMascotCue?.({ state: "error" });
    } finally {
      setIsAgentThinking(false);
      onListeningChange?.(false);
    }

    return;
  };

  const getLogStyle = (type: Log["type"]) => {
    switch (type) {
      case "success":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      case "info":
        return "text-blue-400";
      case "loading":
        return "text-amber-400 animate-pulse";
      default:
        return "text-white";
    }
  };

  return (
    <div
      className={`terminal-container flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border ${
        theme === "night"
          ? "border-white/10 bg-slate-950 shadow-[0_18px_44px_rgba(0,0,0,0.32)]"
          : "border-slate-800/10 bg-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.16)]"
      } ${className}`}
    >
      <div className="terminal-header flex items-center justify-between bg-slate-900 px-3 py-2 text-xs font-mono text-slate-300">
        <span className="inline-flex items-center gap-2">
          <Bot size={14} className="text-emerald-300" />
          chrysalis.agent
        </span>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={13} className="text-emerald-300" />
          {isAgentThinking
            ? "planning"
            : pendingPlan
              ? "awaiting confirm"
              : "online"}
        </span>
      </div>

      <div
        ref={terminalRef}
        className="terminal-content min-h-0 flex-1 basis-0 overflow-y-auto bg-slate-800 px-4 py-3 font-mono text-xs leading-relaxed"
      >
        {allLogs.map((log, index) => (
          <div
            key={index}
            className={`my-1 break-words whitespace-pre-wrap ${getLogStyle(log.type)}`}
          >
            <span className="text-slate-400">
              [{log.timestamp.toLocaleTimeString()}]{" "}
            </span>
            <span>{log.message}</span>
          </div>
        ))}

        {!allLogs.length && (
          <div className="text-gray-500 italic">No logs to display</div>
        )}
      </div>

      {interactive && (
        <form
          onSubmit={handleCommandSubmit}
          className="terminal-input flex flex-none border-t border-white/10 bg-slate-900"
        >
          <span className="flex flex-none items-center px-3 py-2 text-xs font-mono text-emerald-300">
            $
          </span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="min-w-0 flex-1 bg-slate-900 px-2 py-2 text-xs font-mono text-slate-100 focus:outline-none"
            placeholder={
              pendingPlan
                ? "Type confirm to execute or cancel to abort..."
                : stakeState === "protocol"
                  ? `Enter protocol (${supportedProtocols.join("/")})...`
                  : stakeState === "amount"
                    ? `Enter amount in ${assetSymbol}...`
                    : "Ask the agent: stake 10 USDC on Arc..."
            }
            disabled={isAgentThinking}
          />
          <button
            type="submit"
            className="flex-none px-3 text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Send size={14} />
          </button>
        </form>
      )}
    </div>
  );
};

export default Terminal;
