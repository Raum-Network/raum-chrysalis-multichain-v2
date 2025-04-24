import { motion } from 'framer-motion';
import { Crown, Star, Trophy, Shield } from 'lucide-react';
import ProgressBar from './ProgressBar';

interface TierCardProps {
  tier: {
    name: string;
    icon: 'bronze' | 'silver' | 'gold' | 'platinum';
    minAmount: number;
    apr: number;
    benefits: string[];
    color: string;
  };
  userAmount?: number;
}

const TierCard: React.FC<TierCardProps> = ({ tier, userAmount = 0 }) => {
  const icons = {
    bronze: <Shield size={24} />,
    silver: <Star size={24} />,
    gold: <Trophy size={24} />,
    platinum: <Crown size={24} />
  };

  const colors = {
    bronze: 'from-amber-700/30 to-amber-800/30',
    silver: 'from-gray-400/30 to-gray-500/30',
    gold: 'from-yellow-500/30 to-amber-600/30',
    platinum: 'from-purple-500/30 to-purple-600/30'
  };

  const borderColors = {
    bronze: 'border-amber-700/50',
    silver: 'border-gray-400/50',
    gold: 'border-yellow-500/50',
    platinum: 'border-purple-500/50'
  };

  return (
    <motion.div 
      className={`
        relative border rounded-lg overflow-hidden
        ${borderColors[tier.icon]}
        bg-gradient-to-br ${colors[tier.icon]}
        backdrop-blur-sm
      `}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 10 }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">{tier.name}</h3>
          <div className={`p-2 rounded-full bg-${tier.color}/20`}>
            {icons[tier.icon]}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm opacity-70 mb-1">Minimum Stake</div>
          <div className="text-xl font-medium">{tier.minAmount} ETH</div>
        </div>

        <div className="mb-4">
          <div className="text-sm opacity-70 mb-1">APR</div>
          <div className="text-xl font-medium text-green-400">{tier.apr}%</div>
        </div>

        {userAmount > 0 && (
          <div className="mb-4">
            <div className="text-sm opacity-70 mb-1">Progress to Next Tier</div>
            <ProgressBar 
              value={userAmount} 
              max={tier.minAmount} 
              height={4}
              color={`bg-${tier.color}`}
            />
          </div>
        )}

        <div className="border-t border-amber-700/30 pt-4 mt-4">
          <div className="text-sm opacity-70 mb-2">Benefits</div>
          <ul className="space-y-2">
            {tier.benefits.map((benefit, index) => (
              <li key={index} className="text-sm flex items-center">
                <span className="mr-2">•</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

export default TierCard;