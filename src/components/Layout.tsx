import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="h-screen overflow-hidden bg-black text-slate-100">
      <main className="h-full min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default Layout;
