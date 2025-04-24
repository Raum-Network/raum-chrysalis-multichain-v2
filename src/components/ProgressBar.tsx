import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
  showLabel?: boolean;
  height?: number;
  color?: string;
}

const ProgressBar = ({
  value,
  max,
  className = '',
  showLabel = true,
  height = 6,
  color = 'bg-amber-500'
}: ProgressBarProps) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <div 
          className="w-full bg-gray-700/50 rounded-full overflow-hidden"
          style={{ height: `${height}px` }}
        >
          <motion.div
            className={`h-full ${color} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ 
              duration: 1, 
              ease: "easeOut" 
            }}
          />
        </div>
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-xs opacity-70">{value}</span>
          <span className="text-xs opacity-70">{percentage.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;