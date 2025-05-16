import { useState, ReactNode } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface WindowProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const Window = ({ title, children, className = '' }: WindowProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    if (isFullscreen) setIsFullscreen(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (isCollapsed) setIsCollapsed(false);
  };

  return (
    <motion.div
      className={`
        window-container border-2 border-amber-700 rounded-md overflow-hidden
        ${isFullscreen ? 'fixed inset-4 z-50' : 'relative'} 
        ${className}
      `}
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="window-header flex justify-between items-center p-2 bg-amber-800 text-beige-100">
        <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
        <div className="flex space-x-1">
          {/* <button
            onClick={toggleCollapse}
            className="p-1 hover:bg-amber-700 rounded"
          >
            <Minimize2 size={14} />
          </button> */}
          <button
            onClick={toggleFullscreen}
            className="p-1 hover:bg-amber-700 rounded"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {/* <button
            className="p-1 hover:bg-red-700 rounded"
          >
            <X size={14} />
          </button> */}
        </div>
      </div>
      
      <motion.div
        className={`window-content p-3 w-full ${isCollapsed ? 'h-0 overflow-hidden' : ''}`}
        animate={{ height: isCollapsed ? 0 : 'auto' }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default Window;