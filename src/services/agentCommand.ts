import { BridgeProtocol } from '../config/contract';

export type AgentAction =
  | 'stake'
  | 'fees'
  | 'balance'
  | 'routes'
  | 'network'
  | 'status'
  | 'faucet'
  | 'help'
  | 'explain'
  | 'unknown';

export interface AgentCommandContext {
  address?: string | null;
  isConnected: boolean;
  networkName: string;
  chainId: number;
  explorer: string;
  supportedProtocols: BridgeProtocol[];
  assetSymbol: string;
  assetBalance: number;
  linkBalance: number;
  destinationDomain?: number;
  sourceDomainId?: number;
  contracts?: Record<string, string | number | undefined>;
}

export interface AgentPlan {
  action: AgentAction;
  confidence: number;
  amount: number | null;
  asset: string;
  protocol: BridgeProtocol | null;
  targetNetwork: string | null;
  requiresConfirmation: boolean;
  reply: string;
  steps: string[];
  warnings: string[];
}

export interface AgentCommandResponse {
  plans: AgentPlan[];
  source: 'gemini' | 'fallback';
  error?: string;
}

export async function planAgentCommand(
  command: string,
  context: AgentCommandContext
): Promise<AgentCommandResponse> {
  const response = await fetch('/api/agent/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, context }),
  });

  const responseText = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    if (!response.ok && !responseText) {
      throw new Error(
        `Agent backend is not reachable through /api (${response.status}). Start it with: node server.js`
      );
    }

    throw new Error(
      responseText
        ? `Agent endpoint returned non-JSON response: ${responseText.slice(0, 120)}`
        : 'Agent endpoint returned an empty response. Check that the local API server is running.'
    );
  }

  if (!payload || typeof payload !== 'object' || (!('plan' in payload) && !('plans' in payload))) {
    const error = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : 'Agent did not return a plan';
    throw new Error(error);
  }

  const result = payload as any;
  if (result.plan && !result.plans) {
    result.plans = [result.plan];
  }

  return result as AgentCommandResponse;
}
