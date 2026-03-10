import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useWallet } from '../lib/walletConnect';
import { useStaking } from '../hooks/useStaking';
import stakeManager, { StakeStatus } from '../lib/stakeManager';
import { useTheme } from '../context/ThemeContext';

interface Log {
  message: string;
  type: 'success' | 'info' | 'error' | 'warning' | 'command' | 'loading';
  timestamp: Date;
}

interface TerminalProps {
  logs?: Log[];
  interactive?: boolean;
  className?: string;
}

const Terminal = ({ logs = [], interactive = false, className = '' }: TerminalProps) => {
  const [allLogs, setAllLogs] = useState<Log[]>(logs);
  const [command, setCommand] = useState('');
  const [stakeState, setStakeState] = useState<'idle' | 'protocol' | 'amount'>('idle');
  const [selectedProtocol, setSelectedProtocol] = useState<'CCIP' | 'CCTP' | 'Axelar ITS' | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { getFormattedBalance } = useWallet();
  const { stake, bridgeProtocol, setBridgeProtocol, usdcBalance, linkBalance, supportedProtocols, assetSymbol } = useStaking();

  useEffect(() => {
    // Auto-scroll to bottom when logs update
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [allLogs]);

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    // Add the command to logs
    const newLogs: Log[] = [
      ...allLogs,
      {
        message: `> ${command}`,
        type: 'command',
        timestamp: new Date()
      }
    ];

    // Handle different states of staking process
    if (stakeState === 'protocol') {
      const protocol = command.trim().toUpperCase();
      const normalizedProtocol = protocol === 'AXELAR' ? 'AXELAR ITS' : protocol;
      const isProtocolInput = (value: string): value is 'CCIP' | 'CCTP' | 'AXELAR ITS' =>
        value === 'CCIP' || value === 'CCTP' || value === 'AXELAR ITS';
      const protocolMap = new Map([
        ['CCIP', 'CCIP'],
        ['CCTP', 'CCTP'],
        ['AXELAR ITS', 'Axelar ITS'],
      ] as const);
      const selected = isProtocolInput(normalizedProtocol)
        ? protocolMap.get(normalizedProtocol)
        : undefined;

      if (!selected || !supportedProtocols.includes(selected)) {
        setAllLogs([
          ...newLogs,
          {
            message: `Unsupported protocol. Allowed protocols: ${supportedProtocols.join(', ')}`,
            type: 'error',
            timestamp: new Date()
          }
        ]);
        setCommand('');
        return;
      }

      setSelectedProtocol(selected);
      setBridgeProtocol(selected);
      setStakeState('amount');
      setAllLogs([
        ...newLogs,
        {
          message: `Selected protocol: ${selected}. Please enter the amount of ${assetSymbol} to stake:`,
          type: 'info',
          timestamp: new Date()
        }
      ]);
      setCommand('');
      return;
    }

    if (stakeState === 'amount') {
      const inputValue = command.trim();

      // Check if input has more than 6 decimal places
      const parts = inputValue.split('.');
      if (parts[1] && parts[1].length > 6) {
        setAllLogs([
          ...newLogs,
          {
            message: 'Amount can only have up to 6 decimal places',
            type: 'error',
            timestamp: new Date()
          }
        ]);
        setCommand('');
        return;
      }

      const amount = parseFloat(inputValue);
      if (isNaN(amount) || amount <= 0) {
        setAllLogs([
          ...newLogs,
          {
            message: 'Invalid amount. Please enter a valid number:',
            type: 'error',
            timestamp: new Date()
          }
        ]);
        setCommand('');
        return;
      }

      if (amount > usdcBalance) {
        setAllLogs([
          ...newLogs,
          {
            message: `Insufficient ${assetSymbol} balance. Your current ${assetSymbol} balance is ${usdcBalance.toFixed(2)} ${assetSymbol}`,
            type: 'error',
            timestamp: new Date()
          }
        ]);
        setCommand('');
        return;
      }

      if (bridgeProtocol === 'CCIP' && linkBalance < 10) {
        setAllLogs([
          ...newLogs,
          {
            message: `Insufficient LINK balance. Your current LINK balance is ${linkBalance.toFixed(2)} LINK`,
            type: 'error',
            timestamp: new Date()
          }
        ]);
        setCommand('');
        return;
      }

      try {
        const protoLabel = selectedProtocol || bridgeProtocol;
        setAllLogs([
          ...newLogs,
          {
            message: `Staking ${amount} ${assetSymbol} using ${protoLabel} protocol...`,
            type: 'info',
            timestamp: new Date()
          }
        ]);

        await stake(amount);
        setAllLogs([
          ...newLogs,
          {
            message: `Staking Completed. Staked ${amount} ${assetSymbol} using ${protoLabel} protocol...`,
            type: 'success',
            timestamp: new Date()
          }
        ]);

        // Subscribe to stake status updates
        const unsubscribe = stakeManager.subscribeToStatus((status: StakeStatus) => {
          if (status.status === 'SUCCESS' && selectedProtocol === 'CCTP' && status.destinationTxHash) {
            setAllLogs(prevLogs => [
              ...prevLogs,
              {
                message: `CCTP Transaction Success! Destination TX Hash: ${status.destinationTxHash}`,
                type: 'success',
                timestamp: new Date()
              }
            ]);
            unsubscribe();
          }
        });

        setStakeState('idle');
        setSelectedProtocol(null);
      } catch (error) {
        setAllLogs([
          ...newLogs,
          {
            message: `Staking failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'error',
            timestamp: new Date()
          }
        ]);
        setStakeState('idle');
        setSelectedProtocol(null);
      }
      setCommand('');
      return;
    }

    // Handle regular commands
    setTimeout(() => {
      let responseType: Log['type'] = 'info';
      let responseMessage = 'Command not recognized';

      if (command.toLowerCase().includes('help')) {
        responseMessage = 'Available commands: stake, balance';
      } else if (command.toLowerCase().includes('stake')) {
        if (supportedProtocols.length === 1) {
          setSelectedProtocol(supportedProtocols[0]);
          setBridgeProtocol(supportedProtocols[0]);
          setStakeState('amount');
          responseMessage = `Staking via ${supportedProtocols[0]}. Please enter the amount of ${assetSymbol} to stake:`;
        } else {
          setStakeState('protocol');
          responseMessage = `Please select a bridge protocol (${supportedProtocols.join(' or ')}):`;
        }
      } else if (command.toLowerCase().includes('balance')) {
        const balance = assetSymbol === 'USDC' ? getFormattedBalance() : usdcBalance.toFixed(4);
        responseMessage = `Current ${assetSymbol} balance: ${balance} ${assetSymbol}`;
        responseType = 'success';
      }

      setAllLogs([
        ...newLogs,
        {
          message: responseMessage,
          type: responseType,
          timestamp: new Date()
        }
      ]);
    }, 500);

    setAllLogs(newLogs);
    setCommand('');
  };

  const getLogStyle = (type: Log['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      case 'loading':
        return 'text-amber-400 animate-pulse';
      default:
        return 'text-white';
    }
  };

  return (
    <div
      className={`terminal-container flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border ${theme === 'night'
          ? 'border-white/10 bg-slate-800 shadow-[0_18px_44px_rgba(0,0,0,0.32)]'
          : 'border-slate-800/10 bg-slate-800 shadow-[0_18px_44px_rgba(15,23,42,0.16)]'
        } ${className}`}
    >
      <div className="terminal-header flex items-center justify-between bg-slate-900 px-3 py-2 text-xs font-mono text-slate-300">
        <span>ops.console</span>
        <span>{new Date().toLocaleString()}</span>
      </div>

      <div
        ref={terminalRef}
        className="terminal-content flex-1 overflow-y-auto bg-slate-800 px-4 py-3 font-mono text-xs leading-relaxed"
      >
        {allLogs.map((log, index) => (
          <div key={index} className={`my-1 ${getLogStyle(log.type)}`}>
            <span className="text-slate-400">[{log.timestamp.toLocaleTimeString()}] </span>
            <span>{log.message}</span>
          </div>
        ))}

        {!allLogs.length && (
          <div className="text-gray-500 italic">No logs to display</div>
        )}
      </div>

      {interactive && (
        <form onSubmit={handleCommandSubmit} className="terminal-input flex border-t border-white/10 bg-slate-900">
          <span className="flex items-center px-3 py-2 text-xs font-mono text-emerald-300">$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="flex-1 bg-slate-900 px-2 py-2 text-xs font-mono text-slate-100 focus:outline-none"
            placeholder={stakeState === 'protocol'
              ? `Enter protocol (${supportedProtocols.join('/')})...`
              : stakeState === 'amount'
                ? `Enter amount in ${assetSymbol}...`
                : 'Type command...'}
          />
          <button
            type="submit"
            className="px-3 text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Send size={14} />
          </button>
        </form>
      )}
    </div>
  );
};

export default Terminal;
