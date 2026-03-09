import { useState, ReactNode } from 'react';
import { Minimize2, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface WindowProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const Window = ({ title, children, className = '' }: WindowProps) => {
  const [isCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <motion.div
      className={`window-container flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] ${isFullscreen ? 'fixed inset-4 z-50' : 'relative'} ${className}`}
      layout
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    >
      <div className="window-header flex items-center justify-between px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.24em] muted-copy">{title}</h3>
        </div>
        <button
          onClick={toggleFullscreen}
          className="rounded-xl p-2 transition-colors hover:bg-black/5"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      <motion.div
        className={`window-content min-h-0 w-full flex-1 p-4 sm:p-5 ${isCollapsed ? 'h-0 overflow-hidden' : ''}`}
        animate={{ height: isCollapsed ? 0 : 'auto' }}
        transition={{ duration: 0.25 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default Window;
