import { AGENT_KNOWLEDGE } from './_agentKnowledge.js';

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const ALLOWED_ACTIONS = ['stake', 'fees', 'balance', 'routes', 'network', 'status', 'faucet', 'help', 'explain', 'unknown'];
const ALLOWED_PROTOCOLS = ['CCIP', 'CCTP', 'Axelar ITS'];

const classifySingleIntent = (input, context) => {
  const supportedProtocols = Array.isArray(context.supportedProtocols) ? context.supportedProtocols : [];
  const amountMatch = input.match(/(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? Number(amountMatch[1]) : null;
  const protocol = input.includes('ccip')
    ? 'CCIP'
    : input.includes('cctp') || input.includes('arc')
      ? 'CCTP'
      : input.includes('axelar')
        ? 'Axelar ITS'
        : supportedProtocols[0] || null;

  const asksForFee = /(fee|fees|gas|cost|charge|estimate|simulation|simulate)/.test(input)
    && /(stake|staking|bridge|route|usdc|arc|cctp|ccip|transaction)/.test(input);
  const asksQuestion = /(what|how|why|explain|tell me|show me|current|status)/.test(input);

  if (asksForFee) {
    return {
      action: 'fees',
      confidence: 0.78,
      amount,
      asset: context.assetSymbol || 'USDC',
      protocol,
      targetNetwork: context.networkName || null,
      requiresConfirmation: false,
      reply: `I will estimate fees for ${amount || 'the requested'} ${context.assetSymbol || 'USDC'} route on ${context.networkName || 'the active network'}. No transaction will be prepared.`,
      steps: ['Use wallet and RPC context', 'Simulate the route', 'Show estimated gas and protocol fees'],
      warnings: ['Fees can change before confirmation'],
    };
  }

  if (!asksQuestion && (input.includes('stake') || input.includes('bridge'))) {
    return {
      action: 'stake',
      confidence: amount ? 0.72 : 0.54,
      amount,
      asset: context.assetSymbol || 'USDC',
      protocol,
      targetNetwork: input.includes('arc') ? 'Arc Testnet' : context.networkName || null,
      requiresConfirmation: Boolean(amount),
      reply: amount
        ? `I can prepare ${amount} ${context.assetSymbol || 'USDC'} via ${protocol || 'the available route'}. Type confirm to execute.`
        : `I can help stake. Tell me the amount, for example: stake 10 ${context.assetSymbol || 'USDC'} on Arc.`,
      steps: ['Check wallet', 'Validate balance', 'Prepare route', 'Ask for confirmation'],
      warnings: [],
    };
  }

  if (input.includes('balance')) {
    return {
      action: 'balance',
      confidence: 0.82,
      amount: null,
      asset: context.assetSymbol || 'USDC',
      protocol: null,
      targetNetwork: context.networkName || null,
      requiresConfirmation: false,
      reply: `Current ${context.assetSymbol || 'asset'} balance: ${context.assetBalance ?? 'unknown'}.`,
      steps: [],
      warnings: [],
    };
  }

  if (input.includes('route') || input.includes('protocol')) {
    return {
      action: 'routes',
      confidence: 0.78,
      amount: null,
      asset: context.assetSymbol || 'USDC',
      protocol: null,
      targetNetwork: context.networkName || null,
      requiresConfirmation: false,
      reply: `Available routes on ${context.networkName || 'this network'}: ${supportedProtocols.join(', ') || 'none configured'}.`,
      steps: [],
      warnings: [],
    };
  }

  if (input.includes('network') || input.includes('arc')) {
    return {
      action: 'network',
      confidence: 0.72,
      amount: null,
      asset: context.assetSymbol || 'USDC',
      protocol: null,
      targetNetwork: context.networkName || 'Arc Testnet',
      requiresConfirmation: false,
      reply: `Active network: ${context.networkName || 'unknown'}. Supported protocols: ${supportedProtocols.join(', ') || 'none configured'}.`,
      steps: [],
      warnings: [],
    };
  }

  if (input.includes('help') || input.includes('what can you')) {
    return {
      action: 'help',
      confidence: 0.9,
      amount: null,
      asset: context.assetSymbol || 'USDC',
      protocol: null,
      targetNetwork: context.networkName || null,
      requiresConfirmation: false,
      reply: 'Try: stake 10 USDC on Arc, show balance, show routes, or explain current network.',
      steps: [],
      warnings: [],
    };
  }

  return null;
};

const splitCompoundCommand = (command) => {
  const input = String(command || '').trim();
  if (!input) return [];

  const delimiters = [
    /\s+and\s+/gi,
    /\s+then\s+/gi,
    /\s*;\s*/g,
    /\s*\+\s*/g,
    /\s*&\s*/g,
    /(?<!\d)\s*,\s*(?!\d)/g,    // comma only when NOT between digits (avoid splitting 10,000)
  ];

  let parts = [input];
  for (const delimiter of delimiters) {
    const newParts = [];
    for (const part of parts) {
      const split = part.split(delimiter).map(s => s.trim()).filter(Boolean);
      newParts.push(...split);
    }
    parts = newParts;
  }

  // Strip leading connector remnants (e.g. "then" left at the start of a split)
  parts = parts.map(p => p.replace(/^(then|and|also)\s+/i, '').trim()).filter(Boolean);

  const actionVerbs = /^(stake|bridge|show|check|what|how|tell|get|fetch|estimate|simulate|switch|connect|disconnect|help|explain|list|balance|route|network|status|faucet)/i;
  const merged = [];
  let buffer = '';
  for (const part of parts) {
    if (buffer && !actionVerbs.test(part)) {
      buffer += ' ' + part;
    } else {
      if (buffer) merged.push(buffer);
      buffer = part;
    }
  }
  if (buffer) merged.push(buffer);

  return merged.filter(p => p.length > 1);
};

const fallbackPlan = (command, context = {}) => {
  const subCommands = splitCompoundCommand(command);
  const plans = subCommands
    .map(sub => classifySingleIntent(sub, context))
    .filter(Boolean);

  if (plans.length === 0) {
    return [{
      action: 'unknown',
      confidence: 0.35,
      amount: null,
      asset: context.assetSymbol || 'USDC',
      protocol: null,
      targetNetwork: context.networkName || null,
      requiresConfirmation: false,
      reply: 'Try: stake 10 USDC on Arc, show balance, show routes, or explain current network.',
      steps: [],
      warnings: [],
    }];
  }

  // Deduplicate consecutive identical actions (e.g. "show balance and show balance")
  const deduped = [plans[0]];
  for (let i = 1; i < plans.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (plans[i].action !== prev.action || plans[i].amount !== prev.amount) {
      deduped.push(plans[i]);
    }
  }

  return deduped;
};

const getFallbackPlans = (command, context) => {
  const fallbacks = fallbackPlan(command, context);
  return Array.isArray(fallbacks) ? fallbacks : [fallbacks];
};

const normalizeSinglePlan = (plan, context, fallback) => {
  if (!plan || typeof plan !== 'object') return fallback;

  const action = ALLOWED_ACTIONS.includes(plan.action) ? plan.action : fallback.action;
  const protocol = ALLOWED_PROTOCOLS.includes(plan.protocol) ? plan.protocol : null;
  const amount = Number.isFinite(Number(plan.amount)) && Number(plan.amount) > 0 ? Number(plan.amount) : null;

  return {
    action,
    confidence: Math.max(0, Math.min(1, Number(plan.confidence ?? fallback.confidence))),
    amount,
    asset: typeof plan.asset === 'string' && plan.asset ? plan.asset : context.assetSymbol || 'USDC',
    protocol: protocol || fallback.protocol,
    targetNetwork: typeof plan.targetNetwork === 'string' && plan.targetNetwork ? plan.targetNetwork : context.networkName || null,
    requiresConfirmation: action === 'fees' ? false : Boolean(plan.requiresConfirmation ?? action === 'stake'),
    reply: typeof plan.reply === 'string' && plan.reply ? plan.reply : fallback.reply,
    steps: Array.isArray(plan.steps) ? plan.steps.map(String).slice(0, 6) : fallback.steps,
    warnings: Array.isArray(plan.warnings) ? plan.warnings.map(String).slice(0, 4) : fallback.warnings,
  };
};

const normalizePlans = (parsed, command, context) => {
  const fallbacks = getFallbackPlans(command, context);

  if (parsed && Array.isArray(parsed.plans) && parsed.plans.length > 0) {
    const fallbackPool = [...fallbacks];
    return parsed.plans.map((p) => {
      const fb = fallbackPool.shift() || fallbacks[fallbacks.length - 1];
      return normalizeSinglePlan(p, context, fb);
    });
  }

  const single = parsed?.plan || parsed;
  if (single && typeof single === 'object') {
    return [normalizeSinglePlan(single, context, fallbacks[0])];
  }

  return fallbacks;
};

const extractJsonObject = (text) => {
  const raw = String(text || '').trim();
  if (!raw) {
    throw new Error('Gemini response did not include text.');
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Gemini response was not JSON: ${raw.slice(0, 180)}`);
  }

  return JSON.parse(candidate.slice(start, end + 1));
};

const callGemini = async ({ command, context }) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY is not configured.');
    error.statusCode = 503;
    throw error;
  }

  // Default to Gemini 3.1 Flash Lite for lower-latency planning.
  // Override with GEMINI_MODEL in .env if you need a different model.
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const prompt = [
    'You are Chrysalis Agent, an Arc blockchain command planner.',
    'Return only valid JSON. Do not wrap it in markdown.',
    'Never claim execution happened. Any on-chain action must require explicit confirmation.',
    'Classify fee/gas/cost questions as action "fees". Do not choose stake for fee, gas, cost, balance, status, or explanatory questions.',
    'Choose stake only when the user clearly asks to stake, bridge, prepare, or execute a transaction with an amount.',
    'If the user asks "what will be the fee", "current fee", "gas", "cost", or "how much will I pay" for staking/bridging, action must be "fees", requiresConfirmation false.',
    'If live chain data is required and not present in context, choose fees/status/balance and say the frontend should use RPC simulation or ask for a transaction hash.',
    '',
    'Knowledge base:',
    AGENT_KNOWLEDGE,
    '',
    'Schema:',
    JSON.stringify({
      plans: [{
        action: ALLOWED_ACTIONS,
        confidence: 'number from 0 to 1',
        amount: 'number or null',
        asset: 'string',
        protocol: [...ALLOWED_PROTOCOLS, null],
        targetNetwork: 'string or null',
        requiresConfirmation: 'boolean',
        reply: 'short terminal-friendly response',
        steps: ['short step strings'],
        warnings: ['short warning strings'],
      }]
    }),
    'If the user asks for multiple commands, return multiple plans in the array.',
    '',
    'Available actions:',
    ALLOWED_ACTIONS.join(', '),
    '',
    'Available protocols:',
    ALLOWED_PROTOCOLS.join(', '),
    '',
    'Intent examples (single and multi):',
    JSON.stringify([
      { user: 'stake 10 usdc', action: 'stake', requiresConfirmation: true },
      { user: 'what fees will i pay to stake 10 usdc', action: 'fees', requiresConfirmation: false },
      { user: 'estimate gas for staking 10 usdc on Arc', action: 'fees', requiresConfirmation: false },
      { user: 'how does CCTP work', action: 'explain', requiresConfirmation: false },
      { user: 'show my balance', action: 'balance', requiresConfirmation: false },
      { user: 'stake 10 usdc and show my balance', action: 'stake,balance', requiresConfirmation: true },
      { user: 'stake 5 usdc on Arc then check fees', action: 'stake,fees', requiresConfirmation: true },
      { user: 'show routes and my balance', action: 'routes,balance', requiresConfirmation: false },
    ]),
    '',
    'User command and runtime context:',
    JSON.stringify({ command, context }),
  ].join('\n');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            plans: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  action: { type: 'STRING', enum: ALLOWED_ACTIONS },
                  confidence: { type: 'NUMBER' },
                  amount: { type: 'NUMBER', nullable: true },
                  asset: { type: 'STRING' },
                  protocol: { type: 'STRING', enum: ALLOWED_PROTOCOLS, nullable: true },
                  targetNetwork: { type: 'STRING', nullable: true },
                  requiresConfirmation: { type: 'BOOLEAN' },
                  reply: { type: 'STRING' },
                  steps: { type: 'ARRAY', items: { type: 'STRING' } },
                  warnings: { type: 'ARRAY', items: { type: 'STRING' } },
                },
                required: [
                  'action',
                  'confidence',
                  'amount',
                  'asset',
                  'protocol',
                  'targetNetwork',
                  'requiresConfirmation',
                  'reply',
                  'steps',
                  'warnings',
                ],
              }
            }
          },
          required: ['plans'],
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Gemini request failed (${response.status}): ${detail}`);
    error.statusCode = response.status;
    throw error;
  }

  const payload = await response.json();
  const outputText = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  return extractJsonObject(outputText);
};

export const createAgentPlan = async ({ command, context }) => {
  const parsed = await callGemini({ command, context });
  return normalizePlans(parsed, command, context);
};

export const handleAgentCommand = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const command = String(body.command || '').trim();
  const context = body.context && typeof body.context === 'object' ? body.context : {};

  if (!command) {
    return json(res, 400, { error: 'Missing command' });
  }

  try {
    const plans = await createAgentPlan({ command, context });
    return json(res, 200, { plans, source: 'gemini' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const fallbackPlans = normalizePlans(null, command, context);
    return json(res, statusCode, {
      error: error instanceof Error ? error.message : 'Agent planning failed',
      plans: fallbackPlans,
      source: 'fallback',
    });
  }
};
