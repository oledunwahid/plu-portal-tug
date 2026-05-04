'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComboboxOption {
  value: string;
  label: string;
  group?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.group?.toLowerCase().includes(q) ?? false)
    );
  }, [options, search]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, ComboboxOption[]>();
    filtered.forEach((o) => {
      const g = o.group ?? '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    });
    return map;
  }, [filtered]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary',
            'focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200',
            !selected && 'text-u-secondary/60',
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown className="h-4 w-4 text-u-secondary opacity-60 shrink-0" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border border-u-border bg-u-card shadow-card-md overflow-hidden"
          align="start"
          sideOffset={4}
        >
          <div className="flex items-center border-b border-u-border px-3">
            <Search className="h-4 w-4 text-u-secondary opacity-50 mr-2 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 py-2.5 text-sm bg-transparent text-u-primary placeholder:text-u-secondary/50 outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-u-secondary">No results found</div>
            ) : (
              Array.from(grouped.entries()).map(([group, items]) => (
                <div key={group}>
                  {group && (
                    <div className="py-1.5 px-2 text-[0.65rem] font-semibold tracking-widest uppercase text-u-secondary/60">
                      {group}
                    </div>
                  )}
                  {items.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        onChange(item.value);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-u-primary',
                        'hover:bg-u-gold/10 transition-colors duration-100',
                        item.value === value && 'bg-u-gold/10'
                      )}
                    >
                      <Check
                        className={cn('h-4 w-4 text-u-gold shrink-0', item.value !== value && 'invisible')}
                      />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
