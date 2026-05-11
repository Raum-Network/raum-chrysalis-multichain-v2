import { useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactGA from 'react-ga4';
import Terminal from '../components/Terminal';
import RelayAnimation, { type BridgeSurfaceData } from '../components/RelayAnimation';
import { useWallet } from '../lib/walletConnect';
import { useStaking } from '../hooks/useStaking';

const Home = () => {
  const { isConnected, address, networkConfig } = useWallet();
  const { usdcBalance, linkBalance, supportedProtocols, assetSymbol } = useStaking();

  useEffect(() => {
    if (address) {
      ReactGA.event({
        category: 'Wallet',
        action: 'Click',
        label: `Connected Wallet ${address}`
      });
    }
  }, [address]);

  const destinationName = networkConfig.name === 'Arc Testnet' ? 'ARBITRUM SEPOLIA' : 'ARC TESTNET';
  const primaryProtocol = supportedProtocols[0] ?? 'DIRECT';
  const routeStage = networkConfig.sourceDomainId !== undefined && networkConfig.destinationDomain !== undefined
    ? `DOMAIN ${networkConfig.sourceDomainId} → ${networkConfig.destinationDomain}`
    : 'DIRECT ROUTE';

  const bridgeData: BridgeSurfaceData = {
    title: 'CHRYSALIS',
    subtitle: 'ARC DIMENSIONAL BRIDGE SURFACE',
    protocol: `${supportedProtocols.join(' / ') || 'DIRECT'} CROSS-CHAIN EXECUTION`,
    activeNetwork: networkConfig.name.toUpperCase(),
    status: isConnected ? 'LIVE TESTNET' : 'READ ONLY',
    selectedRoute: '01',
    routes: [
      {
        id: '01',
        token: assetSymbol,
        amount: usdcBalance.toFixed(4),
        from: networkConfig.name.toUpperCase(),
        to: destinationName,
        protocol: primaryProtocol,
        stage: routeStage,
      },
      ...(linkBalance > 0
        ? [{
            id: '02',
            token: 'LINK',
            amount: linkBalance.toFixed(2),
            from: networkConfig.name.toUpperCase(),
            to: 'EXECUTION ORACLE',
            protocol: 'SERVICE',
            stage: 'FEE RAIL',
          }]
        : []),
    ],
    metrics: {
      mode: primaryProtocol,
      network: networkConfig.name.toUpperCase(),
      routes: String(supportedProtocols.length),
      wallet: isConnected ? 'CONNECTED' : 'STANDBY',
      execution: 'CONFIRM REQUIRED',
      explorer: networkConfig.explorer.replace(/^https?:\/\//, '').toUpperCase(),
    },
  };

  const terminalLogs: { message: string; type: 'success' | 'info' | 'error' | 'warning' | 'command'; timestamp: Date }[] = [
    { message: 'BIOS v2.4.1 - Initializing Chrysalis agent subsystems...', type: 'success', timestamp: new Date() },
    { message: 'Memory check: 16384MB OK', type: 'success', timestamp: new Date() },
    { message: 'Loading kernel modules...', type: 'success', timestamp: new Date() },
    { message: 'Mounting filesystems: [OK]', type: 'success', timestamp: new Date() },
    { message: 'Starting network services: [OK]', type: 'success', timestamp: new Date() },
    { message: ' ██████╗██╗  ██╗██████╗ ██╗   ██╗███████╗ █████╗ ██╗     ██╗███████╗', type: 'success', timestamp: new Date() },
    { message: '██╔════╝██║  ██║██╔══██╗╚██╗ ██╔╝██╔════╝██╔══██╗██║     ██║██╔════╝', type: 'success', timestamp: new Date() },
    { message: '██║     ███████║██████╔╝ ╚████╔╝ ███████╗███████║██║     ██║███████╗', type: 'success', timestamp: new Date() },
    { message: '██║     ██╔══██║██╔══██╗  ╚██╔╝  ╚════██║██╔══██║██║     ██║╚════██║', type: 'success', timestamp: new Date() },
    { message: '╚██████╗██║  ██║██║  ██║   ██║   ███████║██║  ██║███████╗██║███████║', type: 'success', timestamp: new Date() },
    { message: ' ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝', type: 'success', timestamp: new Date() },
    { message: 'Welcome to the Chrysalis Arc agent terminal.', type: 'info', timestamp: new Date() },
    { message: `Network: ${networkConfig.name} | Routes: ${supportedProtocols.join(', ')}`, type: 'info', timestamp: new Date() },
    { message: `Balance: ${usdcBalance.toFixed(4)} ${assetSymbol} | LINK: ${linkBalance.toFixed(2)}`, type: 'info', timestamp: new Date() },
    { message: 'Try: stake 10 USDC on Arc using the fastest route', type: 'command', timestamp: new Date() },
    { message: 'Try: show routes | show balance | explain current network', type: 'command', timestamp: new Date() }
  ];

  return (
    <div className="terminal-home">
      <div className="terminal-noise" aria-hidden="true" />
      <div className="terminal-grid" aria-hidden="true" />
      <motion.main
        className="terminal-home-stage"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <section className="terminal-hero-panel">
          <RelayAnimation data={bridgeData} />
        </section>

        <section className="terminal-only-panel">
          <Terminal
            key={`${networkConfig.name}-${assetSymbol}-${supportedProtocols.join('-')}`}
            logs={terminalLogs}
            interactive
            className="noel-terminal h-full"
          />
        </section>

        <footer className="terminal-home-footer">
          <span>network: {networkConfig.name}</span>
          <span>wallet: {isConnected ? 'connected' : 'standby'}</span>
          <span>asset: {usdcBalance.toFixed(4)} {assetSymbol}</span>
          <span>routes: {supportedProtocols.join('/') || 'none'}</span>
          <span>execution: confirm required</span>
        </footer>
      </motion.main>
    </div>
  );
};

export default Home;
