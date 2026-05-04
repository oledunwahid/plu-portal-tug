'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { UserPlus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  outlet: string;
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function toggleActive(user: User) {
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, active: !u.active } : u));
      toast.success(`${user.name} ${!user.active ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update user');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h1 className="page-title">Users</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {loading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/admin/users/new"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-dark)', color: 'var(--accent-gold)', padding: '0.5rem 1.125rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}
        >
          <UserPlus size={15} />
          Add User
        </Link>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No users found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Outlet</th>
                  <th>Joined</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 500 }}>{user.name}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.email}</td>
                    <td>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: user.role === 'ADMIN' ? '#8B6914' : 'var(--text-secondary)', background: user.role === 'ADMIN' ? 'rgba(184,134,11,0.08)' : 'var(--bg-cream)', border: `1px solid ${user.role === 'ADMIN' ? 'rgba(184,134,11,0.2)' : 'var(--border)'}`, padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>{user.outlet}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(user.createdAt)}</td>
                    <td>
                      <button
                        onClick={() => toggleActive(user)}
                        disabled={togglingId === user.id}
                        style={{ background: 'none', border: 'none', cursor: togglingId === user.id ? 'not-allowed' : 'pointer', color: user.active ? '#2D4A2E' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.25rem 0' }}
                      >
                        {togglingId === user.id ? (
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : user.active ? (
                          <ToggleRight size={18} />
                        ) : (
                          <ToggleLeft size={18} />
                        )}
                        {user.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
