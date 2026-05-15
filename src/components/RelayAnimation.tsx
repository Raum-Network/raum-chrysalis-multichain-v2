import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { motion } from 'framer-motion';

export type BridgeRoute = {
  amount: string;
  from: string;
  id: string;
  protocol: string;
  stage: string;
  to: string;
  token: string;
};

export type BridgeMetrics = {
  execution: string;
  explorer: string;
  mode: string;
  network: string;
  routes: string;
  wallet: string;
};

export type BridgeSurfaceData = {
  activeNetwork: string;
  metrics: BridgeMetrics;
  protocol: string;
  routes: BridgeRoute[];
  selectedRoute: string;
  status: string;
  subtitle: string;
  title: string;
};

type RelayAnimationProps = {
  data: BridgeSurfaceData;
  mascot?: ReactNode;
  showRouteList?: boolean;
};

type PanelProps = {
  children: ReactNode;
  className?: string;
  title?: string;
};

const tokenPalette: Record<string, string> = {
  BTC: '#f7931a',
  ETH: '#8fa2ff',
  EIGEN: '#4c2cff',
  LINK: '#2a5ada',
  SOL: '#03e1ff',
  USDC: '#2775ca',
  XRP: '#23292f',
};

function Panel({ className = '', title, children }: PanelProps) {
  return (
    <div className={`border border-emerald-300/15 bg-black/52 backdrop-blur-sm ${className}`}>
      {title ? (
        <div className="border-b border-emerald-300/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function TokenIcon({ token = 'USDC', size = 20 }: { size?: number; token?: string }) {
  const upper = token.toUpperCase();

  if (upper === 'ETH') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-label="ETH">
        <circle cx="16" cy="16" r="16" fill="#eef3ff" />
        <path d="M16 4.2 8.2 16.7 16 21.2l7.8-4.5L16 4.2Z" fill="#627eea" />
        <path d="M16 22.8 8.2 18.3 16 27.8l7.8-9.5-7.8 4.5Z" fill="#3f51b5" />
        <path d="M16 4.2v17l7.8-4.5L16 4.2Z" fill="#8fa2ff" />
      </svg>
    );
  }

  if (upper === 'BTC') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-label="BTC">
        <circle cx="16" cy="16" r="16" fill="#f7931a" />
        <text x="16" y="22" textAnchor="middle" fontSize="18" fontFamily="monospace" fontWeight="900" fill="white">
          ₿
        </text>
      </svg>
    );
  }

  if (upper === 'SOL') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-label="SOL">
        <circle cx="16" cy="16" r="16" fill="#111827" />
        <defs>
          <linearGradient id="solanaGradient" x1="5" x2="27" y1="7" y2="25">
            <stop offset="0" stopColor="#00ffa3" />
            <stop offset="0.5" stopColor="#dc1fff" />
            <stop offset="1" stopColor="#03e1ff" />
          </linearGradient>
        </defs>
        <path d="M9 8.5h15l-2.3 3H6.7L9 8.5Z" fill="url(#solanaGradient)" />
        <path d="M6.7 14.5h15L19.4 17H4.4l2.3-2.5Z" fill="url(#solanaGradient)" />
        <path d="M9 20.2h15l-2.3 3H6.7l2.3-3Z" fill="url(#solanaGradient)" />
      </svg>
    );
  }

  if (upper === 'EIGEN') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-label="EIGEN">
        <circle cx="16" cy="16" r="16" fill="#f5f1ff" />
        <path d="M9 7h11.5c2.6 0 4.5 1.6 4.5 4 0 1.7-.9 3-2.4 3.6 1.9.5 3.2 2.1 3.2 4.2 0 3.5-2.7 5.8-6.9 5.8H9V7Zm6 5v3h4.2c1.1 0 1.8-.6 1.8-1.5S20.3 12 19.2 12H15Zm0 7v3h4.9c1.2 0 2-.6 2-1.5S21.1 19 19.9 19H15Z" fill="#4c2cff" />
        <path d="M7 7h4v18H7V7Z" fill="#09051f" opacity="0.9" />
      </svg>
    );
  }

  if (upper === 'LINK') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-label="LINK">
        <circle cx="16" cy="16" r="16" fill="#eef3ff" />
        <path d="m16 7.2 7.6 4.4v8.8L16 24.8l-7.6-4.4v-8.8L16 7.2Z" fill="none" stroke="#2a5ada" strokeWidth="2.3" />
      </svg>
    );
  }

  if (upper === 'XRP') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-label="XRP">
        <circle cx="16" cy="16" r="16" fill="#111827" />
        <path d="M9 10.2h3.3l3.6 3.5c1.1 1 2.8 1 3.9 0l3.6-3.5H27l-4.7 4.6c-2.1 2-5.5 2-7.5 0L9 10.2Zm18 11.6h-3.3l-3.6-3.5c-1.1-1-2.8-1-3.9 0L12.6 21.8H9l4.8-4.6c2-2 5.4-2 7.4 0l5.8 4.6Z" fill="white" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="USDC">
      <circle cx="16" cy="16" r="16" fill="#2775ca" />
      <circle cx="16" cy="16" r="11.7" fill="none" stroke="white" strokeWidth="2" opacity="0.92" />
      <text x="16" y="21.5" textAnchor="middle" fontSize="17" fontFamily="monospace" fontWeight="900" fill="white">
        $
      </text>
      <path d="M8.5 12.2c-1.2 1.1-1.8 2.4-1.8 3.8s.6 2.7 1.8 3.8" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M23.5 12.2c1.2 1.1 1.8 2.4 1.8 3.8s-.6 2.7-1.8 3.8" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function TokenCapsule({
  path,
  delay,
  duration = 8,
  token = 'USDC',
}: {
  delay: number;
  duration?: number;
  path: string;
  token?: string;
}) {
  const motionStyle = { offsetPath: `path('${path}')` } as CSSProperties;

  return (
    <motion.g
      initial={{ offsetDistance: '0%' }}
      animate={{ offsetDistance: '100%' }}
      transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
      style={motionStyle}
    >
      <g>
        <rect
          x="-19"
          y="-9"
          width="38"
          height="18"
          rx="9"
          fill="rgba(0,0,0,0.82)"
          stroke="rgba(116,255,225,0.66)"
          strokeWidth="1"
          filter="url(#tokenGlow)"
        />
        <foreignObject x="-8" y="-8" width="16" height="16">
          <div className="flex h-full w-full items-center justify-center">
            <TokenIcon token={token} size={16} />
          </div>
        </foreignObject>
      </g>
    </motion.g>
  );
}

function Portal({
  label,
  rotate = 0,
  scale = 1,
  x,
  y,
}: {
  label: string;
  rotate?: number;
  scale?: number;
  x: number;
  y: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <motion.ellipse
        rx="28"
        ry="48"
        fill="rgba(82,255,172,0.055)"
        stroke="rgba(94,255,159,0.9)"
        strokeWidth="1.5"
        filter="url(#greenGlow)"
        animate={{ opacity: [0.62, 1, 0.62], rx: [25, 31, 25] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.ellipse
        rx="19"
        ry="36"
        fill="none"
        stroke="rgba(220,255,229,0.6)"
        strokeWidth="0.8"
        strokeDasharray="6 7"
        animate={{ strokeDashoffset: [0, -60] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
      />
      <ellipse rx="9" ry="23" fill="none" stroke="rgba(94,255,159,0.45)" strokeWidth="0.8" />
      <text x="0" y="-57" textAnchor="middle" className="fill-emerald-300 font-mono text-[10px] font-bold tracking-[0.18em]">
        {label}
      </text>
    </g>
  );
}

function Conveyor({ d, delay = 0, thick = 17 }: { d: string; delay?: number; thick?: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.075)" strokeWidth={thick} strokeLinecap="round" />
      <motion.path
        d={d}
        fill="none"
        stroke="rgba(94,255,159,0.7)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="11 18"
        filter="url(#greenGlow)"
        animate={{ strokeDashoffset: [0, -116] }}
        transition={{ duration: 4.8, delay, repeat: Infinity, ease: 'linear' }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeDasharray="2 10"
        animate={{ strokeDashoffset: [0, -72] }}
        transition={{ duration: 4.8, delay, repeat: Infinity, ease: 'linear' }}
      />
    </g>
  );
}

function HyperStructure({ tokens }: { tokens: string[] }) {
  const lanes = {
    bottom: 'M 22 396 C 112 402 182 399 247 375 C 306 353 334 342 382 353 C 443 367 509 402 600 398',
    mid: 'M 8 274 C 104 272 194 275 282 279 C 352 282 424 280 518 275 C 564 273 602 272 628 272',
    top: 'M 22 154 C 118 145 184 148 246 176 C 302 201 333 211 380 200 C 439 186 510 154 598 151',
    vertical: 'M 314 35 C 315 116 316 183 316 250 C 316 320 316 394 316 486',
  };

  const wireNodes = [
    [314, 57], [421, 95], [500, 174], [536, 274], [498, 376], [422, 455], [314, 491], [207, 455], [130, 376], [94, 274], [130, 174], [207, 95],
    [314, 122], [421, 178], [456, 274], [421, 370], [314, 426], [207, 370], [172, 274], [207, 178],
  ];

  const wireLines = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0],
    [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 12],
    [0, 12], [1, 13], [2, 14], [3, 14], [4, 15], [5, 16], [6, 16], [7, 17], [8, 18], [9, 18], [10, 19], [11, 12],
    [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [12, 16], [13, 17], [14, 18], [15, 19],
  ];

  const movingTokens = tokens.length > 0 ? tokens : ['USDC', 'USDC', 'USDC', 'USDC'];

  return (
    <svg viewBox="0 0 640 520" className="absolute inset-0 h-full w-full">
      <defs>
        <filter id="greenGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="tokenGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="coreGlow">
          <stop offset="0%" stopColor="rgba(94,255,159,0.45)" />
          <stop offset="55%" stopColor="rgba(94,255,159,0.12)" />
          <stop offset="100%" stopColor="rgba(94,255,159,0)" />
        </radialGradient>
      </defs>

      <circle cx="316" cy="274" r="228" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.9" strokeDasharray="2 7" />
      <circle cx="316" cy="274" r="178" fill="none" stroke="rgba(94,255,159,0.12)" strokeWidth="0.8" />
      <ellipse cx="316" cy="274" rx="248" ry="116" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
      <ellipse cx="316" cy="274" rx="116" ry="248" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />

      <motion.g
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 58, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '316px 274px' }}
      >
        {wireLines.map(([a, b], index) => (
          <line
            key={`${a}-${b}-${index}`}
            x1={wireNodes[a][0]}
            y1={wireNodes[a][1]}
            x2={wireNodes[b][0]}
            y2={wireNodes[b][1]}
            stroke="rgba(225,255,250,0.2)"
            strokeWidth="0.75"
          />
        ))}
        {wireNodes.map(([x, y], index) => (
          <circle key={`${x}-${y}-${index}`} cx={x} cy={y} r={index < 12 ? 2.1 : 1.7} fill="rgba(235,255,252,0.72)" />
        ))}
      </motion.g>

      <motion.g
        animate={{ rotate: [360, 0] }}
        transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '316px 274px' }}
      >
        <g transform="translate(316 274) scale(1.14)">
          <polygon points="0,-175 169,-76 170,125 0,224 -170,125 -170,-76" fill="none" stroke="rgba(94,255,159,0.15)" strokeWidth="0.9" />
          <polygon points="0,-128 128,-52 128,99 0,176 -128,99 -128,-52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
          <line x1="0" y1="-175" x2="0" y2="224" stroke="rgba(94,255,159,0.13)" strokeWidth="0.8" />
          <line x1="-170" y1="0" x2="170" y2="0" stroke="rgba(94,255,159,0.13)" strokeWidth="0.8" />
        </g>
      </motion.g>

      <Conveyor d={lanes.top} delay={0.3} />
      <Conveyor d={lanes.mid} delay={0} thick={20} />
      <Conveyor d={lanes.bottom} delay={0.6} />
      <Conveyor d={lanes.vertical} delay={0.2} thick={15} />

      <Portal x={159} y={174} label="INTENT" rotate={-23} scale={0.78} />
      <Portal x={472} y={174} label="ROUTE" rotate={23} scale={0.78} />
      <Portal x={104} y={274} label="SOURCE" rotate={0} scale={0.78} />
      <Portal x={526} y={274} label="TARGET" rotate={0} scale={0.78} />
      <Portal x={180} y={390} label="SAFETY" rotate={-25} scale={0.74} />
      <Portal x={452} y={390} label="EXECUTE" rotate={25} scale={0.74} />
      <Portal x={316} y={470} label="SETTLE" rotate={90} scale={0.7} />
      <Portal x={316} y={86} label="INGRESS" rotate={90} scale={0.7} />

      <g transform="translate(316 274)">
        <circle r="68" fill="url(#coreGlow)" />
        <motion.circle
          r="48"
          fill="rgba(0,0,0,0.52)"
          stroke="rgba(94,255,159,0.95)"
          strokeWidth="1.5"
          filter="url(#greenGlow)"
          animate={{ r: [45, 52, 45] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <circle r="31" fill="none" stroke="rgba(235,255,245,0.45)" strokeWidth="0.8" />
        <text y="-4" textAnchor="middle" className="fill-emerald-300 font-mono text-[11px] tracking-[0.2em]">
          CHRYSALIS
        </text>
        <text y="14" textAnchor="middle" className="fill-white/70 font-mono text-[9px] tracking-[0.16em]">
          ARC BRIDGE CORE
        </text>
      </g>

      <TokenCapsule path={lanes.top} token={movingTokens[0]} delay={0} />
      <TokenCapsule path={lanes.top} token={movingTokens[1] ?? movingTokens[0]} delay={2.3} />
      <TokenCapsule path={lanes.mid} token={movingTokens[2] ?? movingTokens[0]} delay={0.4} duration={7.4} />
      <TokenCapsule path={lanes.mid} token={movingTokens[3] ?? movingTokens[0]} delay={2.1} duration={7.4} />
      <TokenCapsule path={lanes.mid} token={movingTokens[0]} delay={3.8} duration={7.4} />
      <TokenCapsule path={lanes.bottom} token={movingTokens[1] ?? movingTokens[0]} delay={0.7} duration={8.4} />
      <TokenCapsule path={lanes.bottom} token={movingTokens[2] ?? movingTokens[0]} delay={3.2} duration={8.4} />
      <TokenCapsule path={lanes.vertical} token={movingTokens[3] ?? movingTokens[0]} delay={0.5} duration={6.8} />
      <TokenCapsule path={lanes.vertical} token={movingTokens[0]} delay={2.7} duration={6.8} />
    </svg>
  );
}

function Row({ green, label, value }: { green?: boolean; label: string; value: string }) {
  return (
    <div className="mb-1.5 flex justify-between gap-3 text-[9px]">
      <span className="text-white/45">{label}</span>
      <span className={green ? 'text-emerald-300' : 'text-white/78'}>{value}</span>
    </div>
  );
}

function RouteList({ routes }: { routes: BridgeRoute[] }) {
  return (
    <Panel title="Routes" className="absolute left-3 top-[72px] z-20 w-[168px] rounded-md">
      <div className="divide-y divide-emerald-300/10">
        {routes.slice(0, 3).map((route) => (
          <div key={route.id} className="px-3 py-2 font-mono uppercase">
            <div className="mb-1 flex items-center justify-between text-[9px] tracking-[0.16em]">
              <span className="text-emerald-300/90">{route.id}</span>
              <span className="text-emerald-300">{route.protocol}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-black/70">
                <TokenIcon token={route.token} size={20} />
              </span>
              <span className="text-[12px] font-bold tracking-[0.08em] text-white/90">{route.token}</span>
              <span className="ml-auto text-[11px]" style={{ color: tokenPalette[route.token.toUpperCase()] ?? '#86efac' }}>
                {route.amount}
              </span>
            </div>
            <div className="mt-1 text-[9px] tracking-[0.1em] text-white/58">{route.from} → {route.to}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DetailPanels({ data, selected }: { data: BridgeSurfaceData; selected: BridgeRoute }) {
  return (
    <>
      <Panel title="Route" className="absolute right-3 top-[72px] z-20 w-[168px] rounded-md">
        <div className="px-3 py-3 font-mono uppercase tracking-[0.12em]">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/70">
              <TokenIcon token={selected.token} size={23} />
            </span>
            <span className="text-[13px] font-bold text-white/88">{selected.token}</span>
          </div>
          <Row label="Amount" value={selected.amount} green />
          <Row label="From" value={selected.from} />
          <Row label="To" value={selected.to} />
          <Row label="Protocol" value={selected.protocol} />
          <Row label="Status" value={data.status} green />
        </div>
      </Panel>

      <Panel title="Metrics" className="absolute right-3 bottom-16 z-20 w-[168px] rounded-md">
        <div className="space-y-2 px-3 py-3 font-mono uppercase tracking-[0.12em]">
          <Row label="Mode" value={data.metrics.mode} green />
          <Row label="Routes" value={data.metrics.routes} />
          <Row label="Wallet" value={data.metrics.wallet} />
          <Row label="Execute" value={data.metrics.execution} green />
        </div>
      </Panel>
    </>
  );
}

const defaultBridgeData: BridgeSurfaceData = {
  activeNetwork: 'ARC TESTNET',
  metrics: {
    execution: 'CONFIRM REQUIRED',
    explorer: 'ARCSCAN',
    mode: 'CCTP',
    network: 'ARC TESTNET',
    routes: '1',
    wallet: 'STANDBY',
  },
  protocol: 'CROSS-CHAIN LIQUID STAKING AGGREGATOR',
  routes: [
    {
      amount: '0.0000',
      from: 'ARC TESTNET',
      id: '01',
      protocol: 'CCTP',
      stage: 'DOMAIN 26 → 0',
      to: 'ARBITRUM SEPOLIA',
      token: 'USDC',
    },
  ],
  selectedRoute: '01',
  status: 'READ ONLY',
  subtitle: 'A CLEANER CONTROL SURFACE FOR MULTI-PROTOCOL STAKING',
  title: 'CHRYSALIS',
};

export default function RelayAnimation({
  data = defaultBridgeData,
  mascot,
  showRouteList = true,
}: RelayAnimationProps) {
  const selected = useMemo(
    () => data.routes.find((route) => route.id === data.selectedRoute) ?? data.routes[0] ?? defaultBridgeData.routes[0],
    [data.routes, data.selectedRoute],
  );

  const animatedTokens = useMemo(() => data.routes.map((route) => route.token), [data.routes]);

  return (
    <div className="relative h-full min-h-[560px] w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-emerald-950/30">
      <div className="absolute inset-0 bg-[#030504]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(118,255,178,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(118,255,178,0.035)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(56,255,134,0.14),transparent_38%),radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.055),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.62),transparent_27%,transparent_73%,rgba(0,0,0,0.62))]" />

      <div className="absolute left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-emerald-300/16 bg-black/68 px-4 font-mono uppercase backdrop-blur-sm">
        <div>
          <div className="text-[13px] font-bold tracking-[0.18em] text-emerald-300">{data.title}</div>
          <div className="text-[8px] tracking-[0.18em] text-emerald-300/70">{data.protocol}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-[0.16em] text-emerald-300">{data.activeNetwork}</div>
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="text-[9px] tracking-[0.16em] text-emerald-300"
          >
            ● {data.status}
          </motion.div>
        </div>
      </div>

      {mascot ? (
        <div className="absolute left-4 top-[78px] z-20 h-[276px] w-[332px] overflow-hidden rounded-[28px] border border-cyan-200/12 bg-[linear-gradient(180deg,rgba(3,10,12,0.94),rgba(2,8,10,0.98))] shadow-[0_20px_48px_rgba(0,0,0,0.28)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(190,242,255,0.16),transparent_26%),radial-gradient(circle_at_100%_0%,rgba(129,140,248,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:26px_26px] opacity-40" />
          <div className="absolute inset-[10px] rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_50%_4%,rgba(255,255,255,0.04),transparent_20%),linear-gradient(180deg,rgba(8,20,24,0.35),rgba(3,9,11,0.12))]" />
          <div className="relative h-full w-full p-2">
            {mascot}
          </div>
        </div>
      ) : null}
      {showRouteList ? <RouteList routes={data.routes.slice(0, 4)} /> : null}
      <DetailPanels data={data} selected={selected} />

      <div className={`absolute inset-y-[50px] z-10 ${mascot ? 'left-[122px] right-[108px]' : 'inset-x-[148px]'}`}>
        <HyperStructure tokens={animatedTokens} />
      </div>

      <Panel className="absolute bottom-3 left-3 right-3 z-30 rounded-md">
        <div className="grid grid-cols-3 gap-3 px-3 py-3 font-mono uppercase tracking-[0.14em] text-white/62">
          <div className="text-[9px]">
            <span className="text-emerald-300">Intent</span>
            <br />
            Natural language route planning
          </div>
          <div className="text-[9px]">
            <span className="text-emerald-300">Bridge</span>
            <br />
            {data.metrics.mode} settlement rail
          </div>
          <div className="text-[13px] font-bold text-emerald-300">
            {data.activeNetwork}
            <br />
            {data.status}
          </div>
        </div>
      </Panel>

      <div className="pointer-events-none absolute inset-0 z-40 rounded-xl ring-1 ring-inset ring-emerald-300/16" />
      <div className="pointer-events-none absolute inset-0 z-40 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[length:100%_4px] opacity-50" />
    </div>
  );
}
