import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { getSession } from '@/lib/session';
import { canAccessWineList } from '@/lib/winePermissions';

/**
 * Middleware already answers 403 for this whole section; this server-side check is the second line of
 * defence for the case where a page is reached without the middleware running (e.g. an internal
 * rewrite), so a Wine List page can never render for an account without the permission.
 */
export default async function WineLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  if (!canAccessWineList(session.user)) redirect('/');

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
