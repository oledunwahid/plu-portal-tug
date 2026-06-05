'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PLUSearchResult {
  code: string;
  name: string;
  category: string;
  folder: string | null;
  price: number | null;
}

interface PLUCodeSearchProps {
  value: string;
  onChange: (code: string) => void;
  onItemSelect?: (item: PLUSearchResult) => void;
  inputStyle?: React.CSSProperties;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

export function PLUCodeSearch({
  value,
  onChange,
  onItemSelect,
  inputStyle,
  placeholder = 'PLU code',
  error,
  disabled,
}: PLUCodeSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<PLUSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    try {
      const res = await fetch(`/api/admin/kb/items?search=${encodeURIComponent(q)}&limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: PLUSearchResult[] = (data.items ?? []).map((item: any) => ({
        code: item.code,
        name: item.name,
        category: item.category,
        folder: item.folder ?? null,
        price: item.price ?? null,
      }));
      setResults(items);
      setOpen(items.length > 0);
    } catch {
      setResults([]);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function handleSelect(item: PLUSearchResult) {
    setQuery(item.code);
    onChange(item.code);
    setOpen(false);
    setResults([]);
    if (onItemSelect) onItemSelect(item);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const baseStyle: React.CSSProperties = {
    width: '100%', height: '34px',
    border: `1px solid ${error ? 'rgba(122,46,31,0.5)' : 'var(--input-border)'}`,
    borderRadius: '4px',
    background: disabled ? 'var(--bg-cream)' : 'var(--bg-card)',
    color: 'var(--text-primary)',
    padding: '0 0.625rem', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
    ...inputStyle,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={baseStyle}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          marginTop: '2px', maxHeight: '220px', overflowY: 'auto',
        }}>
          {results.map((item) => (
            <button
              key={item.code}
              type="button"
              onMouseDown={() => handleSelect(item)}
              style={{
                width: '100%', textAlign: 'left', padding: '0.4rem 0.625rem',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: '1px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-cream)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#C9A84C', fontWeight: 600 }}>
                {item.code}
              </span>
              <span style={{ fontSize: '0.71rem', color: 'var(--text-secondary)' }}>
                {item.name} ({item.category})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
