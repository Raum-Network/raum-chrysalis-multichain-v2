import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useWallet } from '../lib/walletConnect';
import { useStaking } from '../hooks/useStaking';
import stakeManager, { StakeStatus } from '../lib/stakeManager';

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
  const [selectedProtocol, setSelectedProtocol] = useState<'CCIP' | 'CCTP' | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const { stake, stakeStatus, isStaking, bridgeProtocol, setBridgeProtocol, usdcBalance  } = useStaking();

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
      // Automatically set protocol to CCTP
      setSelectedProtocol('CCTP');
      setBridgeProtocol('CCTP');
      setStakeState('amount');
      setAllLogs([
        ...newLogs,
        {
          message: `Current protocol is CCTP. Please enter the amount of USDC to stake:`,
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

      if (amount > usdcBalance ) {
        setAllLogs([
          ...newLogs,
          {
            message: `Insufficient balance. Your current USDC balance is ${usdcBalance.toFixed(2)} USDC`,
            type: 'error',
            timestamp: new Date()
          }
        ]);
        setCommand('');
        return;
      }

      try {
        setAllLogs([
          ...newLogs,
          {
            message: `Staking ${amount} USDC using ${selectedProtocol} protocol...`,
            type: 'info',
            timestamp: new Date()
          }
        ]);
        
        await stake(amount);
        setAllLogs([
          ...newLogs,
          {
            message: `Staking Completed. Staked ${amount} USDC using ${selectedProtocol} protocol...`,
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

    console.log('Command:', command);
    // Handle regular commands
    setTimeout(() => {
      let responseType: Log['type'] = 'info';
      let responseMessage = 'Command not recognized';
      
      if (command.toLowerCase().includes('help')) {
        responseMessage = 'Available commands: stake, balance';
      } else if (command.toLowerCase().includes('stake')) {
        setStakeState('protocol');
        setAllLogs([
          ...newLogs,
          {
            message: 'Current protocol is CCTP. Please enter the amount of USDC to stake:',
            type: 'info',
            timestamp: new Date()
          }
        ]);
        setCommand('');
        return;
      } else if (command.toLowerCase().includes('balance')) {
        responseMessage = `Current USDC balance: ${usdcBalance} USDC`;
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
    <div className={`terminal-container rounded-md border border-amber-700/50 overflow-hidden ${className}`}>
      <div className="terminal-header bg-amber-800 text-green-100 px-3 py-1 text-xs flex items-center justify-between">
        <span>terminal:~$</span>
        <span>{new Date().toLocaleString()}</span>
      </div>
      
      <div 
        ref={terminalRef}
        className="terminal-content bg-gray-900 p-3 h-64 overflow-y-auto font-mono text-xs leading-relaxed"
      >
        {allLogs.map((log, index) => (
          <div key={index} className={`my-1 ${getLogStyle(log.type)}`}>
            <span className="opacity-50">[{log.timestamp.toLocaleTimeString()}] </span>
            <span>{log.message}</span>
          </div>
        ))}
        
        {!allLogs.length && (
          <div className="text-gray-500 italic">No logs to display</div>
        )}
      </div>
      
      {interactive && (
        <form onSubmit={handleCommandSubmit} className="terminal-input flex border-t border-amber-700/50">
          <span className="bg-amber-800/50 px-2 py-1 text-xs font-mono flex items-center">$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="flex-1 bg-gray-800 px-2 py-1 text-xs font-mono focus:outline-none text-yellow-100"
            placeholder={stakeState === 'protocol' ? 'Current protocol is CCTP...' : stakeState === 'amount' ? 'Enter amount...' : 'Type command...'}
          />
          <button 
            type="submit" 
            className="bg-amber-700 hover:bg-amber-600 px-3 text-beige-100"
          >
            <Send size={14} />
          </button>
        </form>
      )}
    </div>
  );
};

export default Terminal;