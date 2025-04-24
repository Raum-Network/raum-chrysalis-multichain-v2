import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

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
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when logs update
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [allLogs]);

  const handleCommandSubmit = (e: React.FormEvent) => {
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

    // Simulate response
    setTimeout(() => {
      let responseType: Log['type'] = 'info';
      let responseMessage = 'Command not recognized';

      if (command.toLowerCase().includes('help')) {
        responseMessage = 'Available commands: help, stake, rewards, balance';
      } else if (command.toLowerCase().includes('stake')) {
        responseMessage = 'Staking operation initiated. Confirm in your wallet.';
        responseType = 'success';
      } else if (command.toLowerCase().includes('balance')) {
        responseMessage = 'Current balance: 1.2345 ETH';
      } else if (command.toLowerCase().includes('rewards')) {
        responseMessage = 'Your pending rewards: 0.0123 ETH';
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
            placeholder="Type command..."
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