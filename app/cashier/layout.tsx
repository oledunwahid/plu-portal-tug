import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main
        className="main-content"
        style={{ background: 'var(--bg-cream)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <TopBar />
        <div className="main-inner" style={{ padding: '2rem 2.5rem', flex: 1 }}>
          {children}
        </div>
      </main>
    </>
  );
}
