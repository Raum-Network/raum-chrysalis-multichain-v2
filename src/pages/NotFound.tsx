import { useNavigate } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';
import Button from '../components/Button';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="premium-surface max-w-2xl rounded-[36px] p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[rgba(var(--accent),0.12)] text-[rgb(var(--accent-strong))]">
          <Compass size={28} />
        </div>

        <div className="eyebrow mt-6">Route unavailable</div>
        <h1 className="mt-4 text-6xl font-semibold">404</h1>
        <p className="mt-3 text-xl font-medium">Page not found</p>
        <p className="muted-copy mx-auto mt-3 max-w-lg text-sm leading-6">
          The route you requested is not part of the current Chrysalis workspace. Return to the main dashboard to continue.
        </p>

        <div className="mt-8 flex justify-center">
          <Button onClick={() => navigate('/')} className="min-w-[190px]" icon={<Home size={16} />}>
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
