import { Mailbox, HelpCircle, Settings, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const Sidebar = () => {
  const { theme } = useTheme();

  return (
    <div
      className={`
        w-12 min-w-[5rem] h-full py-6 px-2 sm:px-4 
        flex flex-col justify-between
        ${theme === 'night' ? 'bg-gray-900 text-amber-100' : 'bg-beige-800 text-brown-900'} 
        border-r border-amber-700/50
      `}
    >
      <div className="flex flex-col space-y-2">
        <SidebarItem icon={<Mailbox />}  />
        <SidebarItem icon={<Package />} />
        <SidebarItem icon={<HelpCircle />}  />
        <SidebarItem icon={<Settings />}  />
      </div>

      <div className="text-center text-xs mt-6  pt-2  text-black-300/60">
        <div>v0.1.0</div>
        <div className="text-[10px] mt-1">© 2025 Chrysalis</div>
      </div>
    </div>
  );
};

const SidebarItem = ({
  icon,
  // label
}: {
  icon: React.ReactNode;
  // label: string;
}) => {
  return (
    <motion.button
      className={`
        flex items-center p-3 rounded-md w-6
        hover:bg-amber-700/30 transition-colors justify-start
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div>{icon}</div>
      {/* <span className="ml-3 text-sm whitespace-nowrap">{label}</span> */}
    </motion.button>
  );
};

export default Sidebar;
