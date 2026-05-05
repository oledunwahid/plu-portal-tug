'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { UserPlus, Loader2, ToggleLeft, ToggleRight, Pencil, X, Eye, EyeOff } from 'lucide-react';
import { formatTimestamp } from '@/lib/format';
import { ALL_OUTLETS, OUTLETS_BY_GROUP, OutletGroup } from '@/lib/outlets';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  outlet: string;
  active: boolean;
  createdAt: string;
}

interface EditForm {
  name: string;
  email: string;
  role: string;
  outlet: string;
  active: boolean;
  password: string;
}

const OUTLET_GROUPS: { label: string; key: OutletGroup }[] = [
  { label: 'Union', key: 'UNION' },
  { label: 'CNS', key: 'CNS' },
  { label: 'French', key: 'FRENCH' },
  { label: 'IBR', key: 'IBR' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', email: '', role: 'CASHIER', outlet: '', active: true, password: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

  function openEdit(user: User) {
    setEditUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role, outlet: user.outlet, active: user.active, password: '' });
    setShowPassword(false);
    setPendingCount(null);
    fetch(`/api/admin/requests?status=PENDING&userId=${user.id}&countOnly=1`)
      .then((r) => r.json())
      .then((data: any) => {
        setPendingCount(typeof data.count === 'number' ? data.count : 0);
      })
      .catch(() => {});
  }

  async function saveEdit() {
    if (!editUser) return;
    if (!editForm.name.trim()) { toast.error('Name is required'); return; }
    if (!editForm.email.trim()) { toast.error('Email is required'); return; }
    if (editForm.password && editForm.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    setEditSaving(true);
    try {
      const body: any = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        outlet: editForm.outlet,
        active: editForm.active,
      };
      if (editForm.password) body.password = editForm.password;

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 409) { toast.error(data.error ?? 'Email already in use.'); return; }
      if (res.status === 400) { toast.error(data.error ?? 'Invalid request.'); return; }
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.map((u) => u.id === editUser.id ? { ...u, ...data } : u));
      toast.success('User updated successfully');
      setEditUser(null);
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setEditSaving(false);
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
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-dark)', color: 'var(--accent-gold)', padding: '0.5rem 1.125rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}
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
                  <th style={{ width: '60px' }}></th>
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
                    <td style={{ minWidth: '150px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        {formatTimestamp(user.createdAt).split(', ')[0]}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatTimestamp(user.createdAt).split(', ')[1]}
                      </div>
                    </td>
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
                    <td>
                      <button
                        onClick={() => openEdit(user)}
                        title="Edit user"
                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.25rem 0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <Pencil size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Slide-Over */}
      {editUser && (
        <>
          <div onClick={() => setEditUser(null)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.25)' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50, width: '440px', maxWidth: '100vw', background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', animation: 'slide-in-right 250ms ease' }}>
            <div style={{ padding: '1.125rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Edit User</div>
              <button onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '0.25rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingCount !== null && pendingCount > 0 && (
                <div style={{ background: 'rgba(184,134,11,0.06)', border: '1px solid rgba(184,134,11,0.2)', borderRadius: '6px', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#8B6914', lineHeight: 1.5 }}>
                  This user has <strong>{pendingCount}</strong> pending request{pendingCount !== 1 ? 's' : ''}. Changing their outlet will not update existing requests.
                </div>
              )}

              {[
                { label: 'Name', key: 'name', type: 'text', required: true },
                { label: 'Email', key: 'email', type: 'email', required: true },
              ].map(({ label, key, type, required }) => (
                <div key={key}>
                  <label className="label-caps" style={{ display: 'block', marginBottom: '0.3rem' }}>{label}</label>
                  <input
                    type={type}
                    value={(editForm as any)[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="field-input"
                  />
                </div>
              ))}

              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: '0.3rem' }}>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  style={{ width: '100%', height: '40px', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.875rem', padding: '0 0.75rem', outline: 'none' }}
                >
                  <option value="CASHIER">CASHIER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: '0.3rem' }}>Outlet</label>
                <select
                  value={editForm.outlet}
                  onChange={(e) => setEditForm((f) => ({ ...f, outlet: e.target.value }))}
                  style={{ width: '100%', height: '40px', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.875rem', padding: '0 0.75rem', outline: 'none' }}
                >
                  {OUTLET_GROUPS.map(({ label, key }) => (
                    <optgroup key={key} label={label}>
                      {OUTLETS_BY_GROUP[key].map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="label-caps">Account Active</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, active: !f.active }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: editForm.active ? '#2D4A2E' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: 0 }}
                >
                  {editForm.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  {editForm.active ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: '0.3rem' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Leave blank to keep current password"
                    className="field-input"
                    style={{ paddingRight: '2.5rem' } as any}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 0 }}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                  Leave blank to keep the current password. Min 8 characters if changing.
                </p>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                {editSaving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditUser(null)}
                style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
