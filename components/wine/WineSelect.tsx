'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Plus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeWineText, type WineMasterDataType } from '@/lib/wine';
import { WINE_FIELD_STYLE } from './wineUi';

export interface WineOption {
  id: string;
  name: string;
  normalizedName: string;
}

/**
 * Searchable dropdown over a wine reference list, with inline "create" for the wine team (the master
 * data lists start empty and get filled as the catalog is built).
 *
 * Creating checks the normalized name locally first and shows the existing option instead of firing a
 * request that the server would reject - the server still owns the rule (unique index on
 * (type, normalizedName)), this is just a faster, clearer path to the same answer.
 */
export function WineSelect({
  type,
  label,
  value,
  options,
  onChange,
  onCreated,
  allowCreate = true,
  required = false,
  error,
  placeholder = 'Pilih...',
  disabled = false,
}: {
  type: WineMasterDataType;
  label: string;
  value: string | null;
  options: WineOption[];
  onChange: (id: string | null) => void;
  onCreated?: (option: WineOption) => void;
  allowCreate?: boolean;
  required?: boolean;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = normalizeWineText(query);
    if (!q) return options.slice(0, 60);
    return options.filter((o) => o.normalizedName.includes(q) || normalizeWineText(o.name).includes(q)).slice(0, 60);
  }, [options, query]);

  const normalizedQuery = normalizeWineText(query);
  const exactLocal = normalizedQuery
    ? options.find((o) => o.normalizedName === normalizedQuery) ?? null
    : null;
  const canCreate = allowCreate && normalizedQuery.length > 0 && !exactLocal;

  async function handleCreate() {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/wine-master-data/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409 carries the record that already owns this normalized name - select it rather than
        // leaving the user stuck on a rejected create.
        if (data?.duplicate) {
          const dup = data.duplicate as WineOption;
          onCreated?.(dup);
          onChange(dup.id);
          setOpen(false);
          setQuery('');
          toast.info(data.error ?? 'Data sudah terdaftar, dipilih otomatis.');
          return;
        }
        throw new Error(data?.error ?? 'Gagal menambah data.');
      }
      const item = data.item as WineOption;
      onCreated?.(item);
      onChange(item.id);
      setOpen(false);
      setQuery('');
      toast.success(`${item.name} ditambahkan.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah data.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <label className="label-caps">
        {label}
        {required && <span style={{ color: '#8B3A2A', marginLeft: '0.2rem' }}>*</span>}
      </label>
      <div ref={boxRef} style={{ position: 'relative' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          style={{
            ...WINE_FIELD_STYLE,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            borderColor: error ? '#8B3A2A' : 'var(--input-border)',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <span
            style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {selected?.name ?? placeholder}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
            {selected && !disabled && (
              <X
                size={13}
                style={{ color: 'var(--text-secondary)' }}
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
              />
            )}
            <ChevronDown size={13} style={{ color: 'var(--text-secondary)' }} />
          </span>
        </button>

        {open && (
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 30,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '0.375rem', boxShadow: '0 6px 18px rgba(26,16,8,0.12)',
              maxHeight: '260px', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '0.4rem', borderBottom: '1px solid var(--border)' }}>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canCreate) { e.preventDefault(); handleCreate(); }
                  if (e.key === 'Escape') setOpen(false);
                }}
                placeholder={`Cari ${label.toLowerCase()}...`}
                style={{ ...WINE_FIELD_STYLE, height: '30px', fontSize: '0.78rem' }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.length === 0 && !canCreate && (
                <div style={{ padding: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Tidak ada data.
                </div>
              )}
              {filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { onChange(option.id); setOpen(false); setQuery(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.78rem',
                    background: option.id === value ? 'rgba(201,168,76,0.1)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span>{option.name}</span>
                  {option.id === value && <Check size={12} style={{ color: '#8B6914' }} />}
                </button>
              ))}
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.5rem 0.6rem', fontSize: '0.78rem', fontWeight: 500,
                  borderTop: '1px solid var(--border)', background: 'var(--bg-cream)',
                  border: 'none', cursor: creating ? 'wait' : 'pointer', width: '100%',
                  color: '#8B6914',
                }}
              >
                {creating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
                Tambah &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p style={{ fontSize: '0.72rem', color: '#8B3A2A', margin: 0 }}>{error}</p>}
    </div>
  );
}
