import { ReactNode } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatBoxProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  change?: {
    value: number;
    isPositive: boolean;
  };
  suffix?: string;
}

const StatBox = ({ title, value, icon, change, suffix }: StatBoxProps) => {
  return (
    <div className="stat-box border border-amber-700/50 bg-amber-900/20 rounded-lg p-3 backdrop-blur-sm">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xs opacity-70 mb-1">{title}</h3>
          <div className="flex items-end">
            <span className="text-xl font-mono tracking-tight">{value}</span>
            {suffix && <span className="ml-1 text-xs opacity-70">{suffix}</span>}
          </div>
          
          {change && (
            <div className={`flex items-center mt-1 text-xs ${change.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {change.isPositive ? (
                <ArrowUp size={12} className="mr-1" />
              ) : (
                <ArrowDown size={12} className="mr-1" />
              )}
              <span>{Math.abs(change.value).toFixed(2)}%</span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className="bg-amber-700/30 p-2 rounded-md">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatBox;