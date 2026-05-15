import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ReactGA from 'react-ga4';
import Terminal from '../components/Terminal';
import { useWallet } from '../lib/walletConnect';
import { useStaking } from '../hooks/useStaking';
import ChrysalisRobotMascot from '../components/ChrysalisRobotMascot';
import stakeManager, { type StakeStatus } from '../lib/stakeManager';
import { MASCOT_CUE_DURATIONS, type MascotCue, type MascotState } from '../lib/mascot';

const Home = () => {
  const { isConnected, address, networkConfig } = useWallet();
  const { usdcBalance, linkBalance, supportedProtocols, assetSymbol } = useStaking();
  const [terminalListening, setTerminalListening] = useState(false);
  const [manualMascotState, setManualMascotState] = useState<MascotState | null>(null);
  const mascotTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (address) {
      ReactGA.event({
        category: 'Wallet',
        action: 'Click',
        label: `Connected Wallet ${address}`,
      });
    }
  }, [address]);

  const triggerMascotCue = useCallback((cue: MascotCue) => {
    if (mascotTimerRef.current !== null) {
      window.clearTimeout(mascotTimerRef.current);
      mascotTimerRef.current = null;
    }

    if (cue.state === 'idle') {
      setManualMascotState(null);
      return;
    }

    setManualMascotState(cue.state);

    if (cue.sticky) {
      return;
    }

    const duration = cue.durationMs ?? MASCOT_CUE_DURATIONS[cue.state] ?? 2400;
    mascotTimerRef.current = window.setTimeout(() => {
      setManualMascotState(null);
      mascotTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => () => {
    if (mascotTimerRef.current !== null) {
      window.clearTimeout(mascotTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const applyStakeCue = (status: StakeStatus) => {
      if (status.status === 'FAILURE') {
        triggerMascotCue({ state: 'error' });
        return;
      }

      if (status.status === 'SUCCESS') {
        triggerMascotCue({ state: 'staking-success' });
        return;
      }

      if (
        status.status === 'BRIDGING_BACK'
        || status.status === 'COMMITTED'
        || status.status === 'BLESSED'
        || (status.protocol === 'CCTP' && status.attestationStatus && status.attestationStatus !== 'complete')
      ) {
        triggerMascotCue({ state: 'bridge-cross-chain', sticky: true });
        return;
      }

      if (status.status === 'IN_PROGRESS') {
        triggerMascotCue({ state: 'pending-transaction', sticky: true });
      }
    };

    const currentStatus = stakeManager.getCurrentStatus();
    if (currentStatus) {
      applyStakeCue(currentStatus);
    }

    const unsubscribe = stakeManager.subscribeToStatus(applyStakeCue);
    return () => unsubscribe();
  }, [triggerMascotCue]);

  const mascotState = useMemo<MascotState>(
    () => manualMascotState ?? (terminalListening ? 'terminal-listening' : 'idle'),
    [manualMascotState, terminalListening],
  );

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
    { message: 'Try: show routes | show balance | explain current network', type: 'command', timestamp: new Date() },
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
          <div className="terminal-robot-panel">
            <ChrysalisRobotMascot state={mascotState} className="h-full w-full" />
          </div>
        </section>

        <section className="terminal-only-panel">
          <Terminal
            key={`${networkConfig.name}-${assetSymbol}-${supportedProtocols.join('-')}`}
            logs={terminalLogs}
            interactive
            className="noel-terminal h-full"
            onListeningChange={setTerminalListening}
            onMascotCue={triggerMascotCue}
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
