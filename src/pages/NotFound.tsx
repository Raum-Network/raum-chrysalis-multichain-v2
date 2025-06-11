import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Bug, Terminal } from 'lucide-react';

const NotFound = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className={`
        max-w-2xl w-full p-8 rounded-lg border-4 border-amber-700
        ${theme === 'night' ? 'bg-gray-900/90' : 'bg-beige-100/90'}
        backdrop-blur-sm
      `}>
        <div className="flex items-center justify-center mb-6">
          <Bug size={48} className={theme === 'night' ? 'text-amber-400' : 'text-amber-700'} />
        </div>
        
        <h1 className="text-4xl font-bold text-center mb-4">
          <span className={theme === 'night' ? 'text-amber-400' : 'text-amber-700'}>404</span>
        </h1>
        
        <div className="text-center mb-8">
          <p className="text-xl mb-2 font-mono">
            <Terminal className="inline-block mr-2" size={20} />
            Page not found in the matrix
          </p>
          <p className="text-sm opacity-70">
            Looks like this page took a wrong turn at the blockchain fork
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {/* <button
            onClick={() => navigate(-1)}
            className={`
              flex items-center justify-center gap-2 px-6 py-3 rounded-md
              ${theme === 'night' 
                ? 'bg-amber-700/20 text-amber-400 hover:bg-amber-700/30' 
                : 'bg-amber-700/10 text-amber-700 hover:bg-amber-700/20'}
              transition-colors
            `}
          >
            <ArrowLeft size={18} />
            Go Back
          </button> */}
          
          <button
            onClick={() => navigate('/')}
            className={`
              flex items-center justify-center gap-2 px-6 py-3 rounded-md
              ${theme === 'night' 
                ? 'bg-amber-700/20 text-amber-400 hover:bg-amber-700/30' 
                : 'bg-amber-700/10 text-amber-700 hover:bg-amber-700/20'}
              transition-colors
            `}
          >
            <Home size={18} />
            Return Home
          </button>
        </div>

        <div className="mt-8 text-center text-sm opacity-50">
          <p className="font-mono">// Error: Page not found in the blockchain</p>
          <p className="font-mono">// Status: Lost in the digital void</p>
          <p className="font-mono">// Solution: Try not to get rekt next time</p>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 