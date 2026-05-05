'use client';

import { useRef, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
  error?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = 'Select…', error }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt]);
  }

  const label = value.length === 0
    ? placeholder
    : value.length === 1
      ? value[0]
      : `${value.length} selected`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.375rem', padding: '0 0.625rem',
          border: `1px solid ${error ? 'rgba(122,46,31,0.5)' : 'var(--input-border)'}`,
          borderRadius: '4px', background: 'var(--bg-card)', color: value.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: '0.8rem', cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <ChevronDown size={11} style={{ flexShrink: 0, color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '5px', padding: '0.3rem', minWidth: '160px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: '220px', overflowY: 'auto',
        }}>
          {options.map((opt) => (
            <label
              key={opt}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.4rem', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '3px', whiteSpace: 'nowrap' }}
            >
              <Checkbox checked={value.includes(opt)} onCheckedChange={() => toggle(opt)} />
              {opt}
            </label>
          ))}
        </div>
      )}

      {error && <p style={{ fontSize: '0.7rem', color: '#8B3A2A', margin: '2px 0 0' }}>{error}</p>}
    </div>
  );
}
