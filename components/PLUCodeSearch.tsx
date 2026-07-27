'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PLUSearchResult {
  code: string;
  name: string;
  category: string;
  folder: string | null;
  price: number | null;
  // Barcode-mode extras (absent for code/name search):
  barcode?: string | null;
  source?: 'MASTER' | 'SAP';
  /** True when the barcode matched only SAP, not the Quinos master - not yet verified. */
  sapOnly?: boolean;
  /** 'NCK' means it matched only after the digits+11 derivation fallback. */
  matchType?: 'EXACT' | 'NCK';
  sapItemNo?: string | null;
}

interface PLUCodeSearchProps {
  value: string;
  onChange: (text: string) => void;
  onItemSelect?: (item: PLUSearchResult) => void;
  inputStyle?: React.CSSProperties;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  /**
   * 'code' searches and displays the PLU code; 'name' searches and displays the item name;
   * 'barcode' scans the dual-source barcode route (Quinos master + SAP, with NCK fallback) and
   * auto-submits on Enter for physical scanners.
   */
  mode?: 'code' | 'name' | 'barcode';
}

export function PLUCodeSearch({
  value,
  onChange,
  onItemSelect,
  inputStyle,
  placeholder = 'PLU code',
  error,
  disabled,
  mode = 'code',
}: PLUCodeSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<PLUSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  // Barcode mode only: tracks a completed search that returned no match, so the
  // dropdown can show "Barcode tidak ditemukan" with the raw scanned input.
  const [notFound, setNotFound] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const onItemSelectRef = useRef(onItemSelect);
  useEffect(() => { onItemSelectRef.current = onItemSelect; }, [onItemSelect]);

  useEffect(() => { setQuery(value); }, [value]);

  // Name/code type-ahead against the master registry.
  const searchItems = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    try {
      // active=1 so inactive items never surface in cashier type-ahead suggestions.
      const res = await fetch(`/api/admin/kb/items?search=${encodeURIComponent(q)}&active=1&limit=10`);
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

  // Barcode scan against the dual-source route (master + SAP, NCK fallback).
  // When autoSelect is set (Enter / scanner) and exactly one item matches, it is
  // selected immediately so the cashier never has to click.
  const searchBarcode = useCallback(async (q: string, autoSelect = false) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults([]); setOpen(false); setNotFound(null); return; }
    try {
      const res = await fetch(`/api/plu/search-barcode?barcode=${encodeURIComponent(trimmed)}`);
      if (!res.ok) return;
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: PLUSearchResult[] = (data.results ?? []).map((r: any) => ({
        code: r.code ?? '',
        name: r.name,
        category: r.category ?? '',
        folder: r.folder ?? null,
        price: r.price ?? null,
        barcode: r.barcode ?? null,
        source: r.source,
        sapOnly: !!r.sapOnly,
        matchType: r.matchType,
        sapItemNo: r.sapItemNo ?? null,
      }));
      if (autoSelect && items.length === 1) {
        handleSelect(items[0]);
        return;
      }
      setResults(items);
      setNotFound(items.length === 0 ? trimmed : null);
      setOpen(true);
    } catch {
      setResults([]);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    if (mode === 'barcode') setNotFound(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (mode === 'barcode') searchBarcode(val);
      else searchItems(val);
    }, 300);
  }

  function handleSelect(item: PLUSearchResult) {
    // Barcode mode leaves the scanned value in the field; code/name modes echo the
    // selected code or name so the input reflects the chosen item.
    if (mode !== 'barcode') {
      const display = mode === 'name' ? item.name : item.code;
      setQuery(display);
      onChange(display);
    }
    setOpen(false);
    setResults([]);
    setNotFound(null);
    if (onItemSelectRef.current) onItemSelectRef.current(item);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false);
    // Scanners send the barcode followed by Enter - submit the search immediately,
    // bypassing the debounce, and auto-select when there's a single match.
    if (e.key === 'Enter' && mode === 'barcode') {
      e.preventDefault();
      clearTimeout(debounceRef.current);
      searchBarcode(query, true);
    }
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
      {open && (mode === 'barcode' ? (results.length > 0 || !!notFound) : results.length > 0) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          marginTop: '2px', maxHeight: '240px', overflowY: 'auto',
        }}>
          {/* Barcode mode: no match - show the raw scanned input so the cashier can verify. */}
          {mode === 'barcode' && results.length === 0 && notFound && (
            <div style={{ padding: '0.55rem 0.7rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={{ color: '#8B3A2A', fontWeight: 600 }}>Barcode tidak ditemukan</span>
              <div style={{ marginTop: '2px' }}>
                Input: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{notFound}</span>
              </div>
            </div>
          )}

          {results.map((item) => (
            <button
              key={item.sapOnly ? `sap-${item.sapItemNo}` : (item.code || item.name)}
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
              {mode === 'barcode' ? (
                <>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-secondary)' }}>
                    {item.sapOnly ? (
                      <>SAP <span style={{ fontFamily: 'monospace', color: '#8B6914' }}>{item.sapItemNo}</span></>
                    ) : (
                      <><span style={{ fontFamily: 'monospace', color: '#C9A84C' }}>{item.code}</span>{item.category ? ` (${item.category})` : ''}</>
                    )}
                    {item.matchType === 'NCK' && <span style={{ marginLeft: '0.4rem', color: 'var(--text-secondary)' }}>· via NCK</span>}
                  </span>
                  {item.sapOnly && (
                    <span style={{ marginTop: '2px', fontSize: '0.68rem', fontWeight: 600, color: '#8B6914', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: '3px', padding: '1px 5px', alignSelf: 'flex-start' }}>
                      Ditemukan di SAP, belum terverifikasi di master
                    </span>
                  )}
                </>
              ) : mode === 'name' ? (
                <>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-secondary)' }}>
                    <span style={{ fontFamily: 'monospace', color: '#C9A84C' }}>{item.code}</span> ({item.category})
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#C9A84C', fontWeight: 600 }}>
                    {item.code}
                  </span>
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-secondary)' }}>
                    {item.name} ({item.category})
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
