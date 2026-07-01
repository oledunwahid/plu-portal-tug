'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Lock, Pencil, Trash2, Plus, RotateCcw, ChevronDown, ChevronRight, X, Check } from 'lucide-react';

interface GlossaryEntry {
  id: string; type: string; term: string; definition: string;
  defaultDefinition: string | null; grp: string | null;
  isSeeded: boolean; createdAt: string; updatedAt: string;
}

type TabType = 'CATEGORIES' | 'PRINTERS_OUTLETS' | 'GENERAL';

const ENTRY_TYPES = ['CATEGORY', 'PRINTER', 'OUTLET', 'GENERAL'];

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}

function EntryRow({ entry, onEdit, onDelete, onReset, canEdit }: {
  entry: GlossaryEntry;
  onEdit: (e: GlossaryEntry) => void;
  onDelete: (id: string) => void;
  onReset: (e: GlossaryEntry) => void;
  canEdit: boolean;
}) {
  const [delConfirm, setDelConfirm] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.term}</span>
          {entry.grp && (
            <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '2px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#8B6914' }}>{entry.grp}</span>
          )}
          {entry.isSeeded && <span title="Seeded entry"><Lock size={10} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} /></span>}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{entry.definition}</div>
      </div>
      {canEdit && (
      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0, alignItems: 'center' }}>
        {entry.isSeeded && entry.definition !== entry.defaultDefinition && (
          <button onClick={() => onReset(entry)} title="Reset to default"
            style={{ padding: '0.2rem 0.4rem', background: 'transparent', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '3px', cursor: 'pointer', color: '#8B6914', display: 'flex', alignItems: 'center' }}>
            <RotateCcw size={11} />
          </button>
        )}
        <button onClick={() => onEdit(entry)}
          style={{ padding: '0.2rem 0.4rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
          <Pencil size={11} />
        </button>
        {!entry.isSeeded && (
          delConfirm ? (
            <>
              <button onClick={() => { onDelete(entry.id); setDelConfirm(false); }}
                style={{ padding: '0.2rem 0.4rem', background: '#7A2E1F', color: 'white', border: 'none', borderRadius: '3px', fontSize: '0.65rem', cursor: 'pointer' }}>Del</button>
              <button onClick={() => setDelConfirm(false)}
                style={{ padding: '0.2rem 0.4rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '0.65rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>No</button>
            </>
          ) : (
            <button onClick={() => setDelConfirm(true)}
              style={{ padding: '0.2rem 0.4rem', background: 'transparent', border: '1px solid rgba(122,46,31,0.2)', borderRadius: '3px', cursor: 'pointer', color: '#7A2E1F', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={11} />
            </button>
          )
        )}
      </div>
      )}
    </div>
  );
}

function AccordionGroup({ title, entries, onEdit, onDelete, onReset, canEdit }: {
  title: string; entries: GlossaryEntry[];
  onEdit: (e: GlossaryEntry) => void; onDelete: (id: string) => void; onReset: (e: GlossaryEntry) => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', padding: '0.625rem 0.875rem', background: 'var(--bg-card)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left' }}>
        {open ? <ChevronDown size={13} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-secondary)' }} />}
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{title}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{entries.length}</span>
      </button>
      {open && (
        <div style={{ padding: '0 0.875rem', background: 'var(--bg-cream)' }}>
          {entries.map((e) => <EntryRow key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} onReset={onReset} canEdit={canEdit} />)}
        </div>
      )}
    </div>
  );
}

interface EditModalProps {
  entry: GlossaryEntry;
  onSave: (id: string, definition: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function EditModal({ entry, onSave, onClose, saving }: EditModalProps) {
  const [definition, setDefinition] = useState(entry.definition);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '480px', maxWidth: '90vw', background: 'var(--bg-card)', borderRadius: '8px', padding: '1.5rem', zIndex: 50, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Edit: {entry.term}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={15} /></button>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          {entry.type} {entry.grp ? `· ${entry.grp}` : ''} {entry.isSeeded ? '· Seeded' : ''}
        </div>
        <textarea
          value={definition} onChange={(e) => setDefinition(e.target.value)}
          style={{ width: '100%', minHeight: '100px', padding: '0.625rem', borderRadius: '5px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button onClick={() => onSave(entry.id, definition)} disabled={saving || !definition.trim()}
            style={{ padding: '0.4rem 0.875rem', background: 'var(--accent-gold)', color: '#1A1008', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose}
            style={{ padding: '0.4rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

interface AddModalProps {
  onSave: (type: string, term: string, definition: string, grp: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function AddModal({ onSave, onClose, saving }: AddModalProps) {
  const [type, setType] = useState('GENERAL');
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [grp, setGrp] = useState('');
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '480px', maxWidth: '90vw', background: 'var(--bg-card)', borderRadius: '8px', padding: '1.5rem', zIndex: 50, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Add Entry</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={15} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
          <div>
            <div className="label-caps" style={{ marginBottom: '0.25rem' }}>Type</div>
            <select value={type} onChange={(e) => setType(e.target.value)}
              style={{ width: '100%', height: '34px', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', padding: '0 0.5rem', fontSize: '0.8rem', outline: 'none' }}>
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div className="label-caps" style={{ marginBottom: '0.25rem' }}>Group (optional)</div>
            <input value={grp} onChange={(e) => setGrp(e.target.value)} placeholder="e.g. IBR"
              style={{ width: '100%', height: '34px', padding: '0 0.625rem', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ marginBottom: '0.625rem' }}>
          <div className="label-caps" style={{ marginBottom: '0.25rem' }}>Term</div>
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. KITCHEN7"
            style={{ width: '100%', height: '34px', padding: '0 0.625rem', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '0.875rem' }}>
          <div className="label-caps" style={{ marginBottom: '0.25rem' }}>Definition</div>
          <textarea value={definition} onChange={(e) => setDefinition(e.target.value)}
            style={{ width: '100%', minHeight: '80px', padding: '0.5rem 0.625rem', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => onSave(type, term, definition, grp)} disabled={saving || !term.trim() || !definition.trim()}
            style={{ padding: '0.4rem 0.875rem', background: 'var(--accent-gold)', color: '#1A1008', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', cursor: (saving || !term.trim() || !definition.trim()) ? 'not-allowed' : 'pointer', opacity: (saving || !term.trim() || !definition.trim()) ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Add Entry'}
          </button>
          <button onClick={onClose}
            style={{ padding: '0.4rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

export default function GlossaryPage() {
  // COST_CONTROL has read-only access — add/edit/delete/reset controls are hidden.
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = ((session?.user as any)?.role ?? '') === 'ADMIN';
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('CATEGORIES');
  const [editEntry, setEditEntry] = useState<GlossaryEntry | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/kb/glossary');
      const data: GlossaryEntry[] = await res.json();
      setEntries(data);
      if (data.length === 0) {
        // Auto-seed
        setSeeding(true);
        try {
          await fetch('/api/admin/kb/glossary/seed', { method: 'POST' });
          const res2 = await fetch('/api/admin/kb/glossary');
          setEntries(await res2.json());
        } finally {
          setSeeding(false);
        }
      }
    } catch {
      toast.error('Failed to load glossary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const q = search.toLowerCase();
  const filtered = q
    ? entries.filter((e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q) || (e.grp ?? '').toLowerCase().includes(q))
    : entries;

  const categories = filtered.filter((e) => e.type === 'CATEGORY');
  const printers = filtered.filter((e) => e.type === 'PRINTER').sort((a, b) => a.term.localeCompare(b.term));
  const outlets = filtered.filter((e) => e.type === 'OUTLET');
  const general = filtered.filter((e) => e.type === 'GENERAL').sort((a, b) => a.term.localeCompare(b.term));

  const catByDept = groupBy(categories, (e) => e.grp ?? 'Other');
  const outletByGroup = groupBy(outlets, (e) => e.grp ?? 'Other');

  async function handleEdit(id: string, definition: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/kb/glossary/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definition }) });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Something went wrong'); return; }
      toast.success('Entry updated');
      await fetchEntries();
      setEditEntry(null);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/kb/glossary/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Something went wrong'); return; }
      toast.success('Entry deleted');
      await fetchEntries();
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function handleReset(entry: GlossaryEntry) {
    if (!entry.defaultDefinition) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/kb/glossary/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definition: entry.defaultDefinition }) });
      if (!res.ok) { toast.error('Something went wrong'); return; }
      toast.success('Entry reset to default');
      await fetchEntries();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(type: string, term: string, definition: string, grp: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/kb/glossary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, term, definition, grp: grp || null }) });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Something went wrong'); return; }
      toast.success('Entry added');
      await fetchEntries();
      setAddOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const TABS: { id: TabType; label: string }[] = [
    { id: 'CATEGORIES', label: 'Categories' },
    { id: 'PRINTERS_OUTLETS', label: 'Printers & Outlets' },
    { id: 'GENERAL', label: 'General' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Glossary</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Reference guide for categories, printers, outlets, and terminology.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'var(--accent-gold)', color: '#1A1008', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
            <Plus size={14} /> Add Entry
          </button>
        )}
      </div>

      {/* Search + tabs */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1rem' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all entries…"
          style={{ width: '100%', maxWidth: '320px', height: '34px', padding: '0 0.75rem', borderRadius: '5px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }} />
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ padding: '0.35rem 0.875rem', borderRadius: '4px', border: `1px solid ${activeTab === id ? 'var(--accent-gold)' : 'var(--border)'}`, background: activeTab === id ? 'rgba(201,168,76,0.08)' : 'transparent', color: activeTab === id ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: activeTab === id ? 600 : 400, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading || seeding ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {seeding ? 'Seeding glossary…' : 'Loading…'}
        </div>
      ) : (
        <div className="card" style={{ padding: '1.25rem' }}>
          {activeTab === 'CATEGORIES' && (
            <>
              {Object.keys(catByDept).length === 0 ? (
                <EmptyState message="No category entries found." />
              ) : (
                Object.entries(catByDept).sort(([a], [b]) => a.localeCompare(b)).map(([dept, ents]) => (
                  <AccordionGroup key={dept} title={dept} entries={ents} onEdit={setEditEntry} onDelete={handleDelete} onReset={handleReset} canEdit={isAdmin} />
                ))
              )}
            </>
          )}

          {activeTab === 'PRINTERS_OUTLETS' && (
            <>
              {printers.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="label-caps" style={{ marginBottom: '0.5rem' }}>Printers</div>
                  {printers.map((e) => <EntryRow key={e.id} entry={e} onEdit={setEditEntry} onDelete={handleDelete} onReset={handleReset} canEdit={isAdmin} />)}
                </div>
              )}
              {Object.keys(outletByGroup).length > 0 && (
                <div>
                  <div className="label-caps" style={{ marginBottom: '0.5rem' }}>Outlets</div>
                  {Object.entries(outletByGroup).sort(([a], [b]) => a.localeCompare(b)).map(([grp, ents]) => (
                    <div key={grp} style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>{grp}</div>
                      {ents.map((e) => <EntryRow key={e.id} entry={e} onEdit={setEditEntry} onDelete={handleDelete} onReset={handleReset} canEdit={isAdmin} />)}
                    </div>
                  ))}
                </div>
              )}
              {printers.length === 0 && Object.keys(outletByGroup).length === 0 && <EmptyState message="No printer or outlet entries found." />}
            </>
          )}

          {activeTab === 'GENERAL' && (
            general.length === 0 ? <EmptyState message="No general entries found." /> :
            general.map((e) => <EntryRow key={e.id} entry={e} onEdit={setEditEntry} onDelete={handleDelete} onReset={handleReset} canEdit={isAdmin} />)
          )}
        </div>
      )}

      {editEntry && (
        <EditModal entry={editEntry} onSave={handleEdit} onClose={() => setEditEntry(null)} saving={saving} />
      )}
      {addOpen && (
        <AddModal onSave={handleAdd} onClose={() => setAddOpen(false)} saving={saving} />
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
      {message}
    </div>
  );
}
