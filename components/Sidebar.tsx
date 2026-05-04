'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Download, Users, Plus, LogOut, Menu, X } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: ('ADMIN' | 'CASHIER')[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/cashier/dashboard', icon: <LayoutDashboard size={15} />, roles: ['CASHIER'] },
  { label: 'New Request', href: '/cashier/request/new', icon: <Plus size={15} />, roles: ['CASHIER'] },
  { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard size={15} />, roles: ['ADMIN'] },
  { label: 'Export', href: '/admin/export', icon: <Download size={15} />, roles: ['ADMIN'] },
  { label: 'Users', href: '/admin/users', icon: <Users size={15} />, roles: ['ADMIN'] },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const role = (sessionUser?.role ?? 'CASHIER') as 'ADMIN' | 'CASHIER';
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontFamily: 'var(--font-display)', color: '#C9A84C', fontSize: '1.1rem', fontWeight: 500 }}>
          The Union Group
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '3px' }}>
          PLU Portal
        </div>
      </div>

      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              padding: '8px 10px', borderRadius: '5px', marginBottom: '2px',
              fontSize: '0.8rem', textDecoration: 'none',
              color: pathname === item.href ? '#C9A84C' : 'rgba(255,255,255,0.5)',
              background: pathname === item.href ? 'rgba(201,168,76,0.12)' : 'transparent',
            }}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#C9A84C', fontWeight: 600, flexShrink: 0 }}>
            {sessionUser?.name?.charAt(0) ?? 'U'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sessionUser?.name}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>
              {sessionUser?.outlet} · {role}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}
        >
          <LogOut size={12} /> Sign Out
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — shown via CSS */}
      <div
        className="sidebar-desktop"
        style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '240px', background: '#1A1008', zIndex: 40 }}
      >
        <SidebarContent />
      </div>

      {/* Mobile topbar — shown via CSS */}
      <div
        className="topbar-mobile"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '52px', background: '#1A1008', zIndex: 50, alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}
      >
        <span style={{ fontFamily: 'var(--font-display)', color: '#C9A84C', fontSize: '1rem', fontWeight: 500 }}>
          The Union Group
        </span>
        <button
          onClick={() => setOpen(true)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 55 }}
          />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '240px', background: '#1A1008', zIndex: 60, animation: 'slide-in-right 220ms ease' }}>
            <button
              onClick={() => setOpen(false)}
              style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={16} />
            </button>
            <SidebarContent onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}

export default Sidebar;
