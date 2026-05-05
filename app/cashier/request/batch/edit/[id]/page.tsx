'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { getCategoriesForOutlet, getDepartmentForCategory } from '@/lib/categories';
import { PRINTERS_BY_GROUP, OUTLETS_BY_GROUP, OutletGroup } from '@/lib/outlets';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Copy, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

const REQUEST_TYPES = [
  { value: 'NEW_ITEM', label: 'New Item' },
  { value: 'UPDATE_PRICE', label: 'Update Price' },
  { value: 'UPDATE_NAME', label: 'Update Name' },
  { value: 'UPDATE_PRINTER', label: 'Change Printer' },
  { value: 'UPDATE_FULL', label: 'Other Update' },
] as const;

type RequestTypeValue = (typeof REQUEST_TYPES)[number]['value'];

interface ItemRow {
  _id: string;
  code: string;
  name: string;
  category: string;
  department: string;
  price: string;
  folder: string;
  serviceCharge: boolean;
  tax1: boolean;
  tax2: boolean;
  noDiscount: boolean;
  hideReceipt: boolean;
  printers: string[];
  outlets: string[];
  errors: Partial<Record<string, string>>;
}

const POS_FIELDS: { key: keyof ItemRow; abbr: string; full: string }[] = [
  { key: 'serviceCharge', abbr: 'SC', full: 'Service Charge' },
  { key: 'tax1', abbr: 'T1', full: 'Tax 1' },
  { key: 'tax2', abbr: 'T2', full: 'Tax 2' },
  { key: 'noDiscount', abbr: 'ND', full: 'No Discount' },
  { key: 'hideReceipt', abbr: 'HR', full: 'Hide on Receipt' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function makeDefaultRow(): ItemRow {
  return {
    _id: uid(), code: '', name: '', category: '', department: '',
    price: '', folder: '',
    serviceCharge: true, tax1: true, tax2: true, noDiscount: true, hideReceipt: false,
    printers: [], outlets: [], errors: {},
  };
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', height: '34px', border: '1px solid var(--input-border)',
  borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)',
  padding: '0 0.625rem', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
};

export default function BatchEditPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const batchId = params.id as string;

  const sessionUser = session?.user as any;
  const outlet = sessionUser?.outlet ?? 'ROMSCBD';
  const outletGroup = (sessionUser?.outletGroup as OutletGroup) ?? 'IBR';

  const categories = getCategoriesForOutlet(outlet);
  const availablePrinters = PRINTERS_BY_GROUP[outletGroup] ?? [];
  const availableOutlets = OUTLETS_BY_GROUP[outletGroup] ?? [];
  const categoryOptions = categories.map((c) => ({ value: c.category, label: c.category, group: c.department }));

  const [pageLoading, setPageLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [requestType, setRequestType] = useState<RequestTypeValue>('NEW_ITEM');
  const [items, setItems] = useState<ItemRow[]>([makeDefaultRow()]);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState('');

  const isUpdate = requestType !== 'NEW_ITEM';
  const needsPrice = requestType === 'NEW_ITEM' || requestType === 'UPDATE_PRICE';
  const showCategoryCol = requestType === 'NEW_ITEM' || requestType === 'UPDATE_FULL';

  useEffect(() => {
    if (!batchId) return;
    fetch(`/api/batches/${batchId}`)
      .then((r) => {
        if (r.status === 403 || r.status === 404) {
          toast.error('Batch not found or access denied');
          router.replace('/cashier/dashboard');
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.status === 'DONE') {
          toast.error('This batch has already been processed and cannot be edited');
          router.replace('/cashier/dashboard');
          return;
        }
        setTitle(data.title);
        setRequestType(data.requestType as RequestTypeValue);
        const loaded: ItemRow[] = (data.items as any[]).map((item: any) => ({
          _id: uid(),
          code: item.code ?? '',
          name: item.name,
          category: item.category,
          department: item.department,
          price: item.price != null ? String(item.price) : '',
          folder: item.folder ?? '',
          serviceCharge: item.serviceCharge,
          tax1: item.tax1,
          tax2: item.tax2,
          noDiscount: item.noDiscount,
          hideReceipt: item.hideReceipt,
          printers: item.printers ? item.printers.split(';').filter(Boolean) : [],
          outlets: item.outlets ? item.outlets.split(';').filter(Boolean) : [],
          errors: {},
        }));
        setItems(loaded.length > 0 ? loaded : [makeDefaultRow()]);
        setPageLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load batch');
        router.replace('/cashier/dashboard');
      });
  }, [batchId, router]);

  const addRow = useCallback(() => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { ...last, _id: uid(), code: '', name: '', errors: {} }];
    });
  }, []);

  function duplicateRow(idx: number) {
    setItems((prev) => {
      const copy: ItemRow = { ...prev[idx], _id: uid(), name: '', errors: {} };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function deleteRow(idx: number) {
    if (items.length <= 1) { toast.error('Cannot remove the last item'); return; }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, key: keyof ItemRow, value: any) {
    setItems((prev) => prev.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, [key]: value, errors: { ...row.errors, [key]: undefined } };
      if (key === 'category') updated.department = getDepartmentForCategory(value as string);
      return updated;
    }));
  }

  function validate(): boolean {
    let valid = true;
    if (!title.trim()) { setTitleError('Batch title is required'); valid = false; }
    const updatedItems = items.map((row) => {
      const errors: Record<string, string> = {};
      if (!row.name.trim()) errors.name = 'Name required';
      if (isUpdate && !row.code.trim()) errors.code = 'Code required';
      if (needsPrice && (!row.price || Number(row.price) <= 0)) errors.price = 'Price required';
      if (row.printers.length === 0) errors.printers = 'Select printer';
      if (row.outlets.length === 0) errors.outlets = 'Select outlet';
      if (Object.keys(errors).length > 0) valid = false;
      return { ...row, errors };
    });
    setItems(updatedItems);
    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) { toast.error('Please fix the errors before saving'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        requestType,
        items: items.map((row) => ({
          code: row.code || undefined,
          name: row.name.trim(),
          category: row.category,
          department: row.department,
          price: row.price ? Number(row.price) : undefined,
          folder: row.folder || undefined,
          serviceCharge: row.serviceCharge,
          tax1: row.tax1,
          tax2: row.tax2,
          noDiscount: row.noDiscount,
          hideReceipt: row.hideReceipt,
          printers: row.printers,
          outlets: row.outlets,
        })),
      };
      const res = await fetch(`/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Save failed');
      }
      toast.success('Batch updated successfully');
      router.push('/cashier/dashboard');
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (pageLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', color: 'var(--text-secondary)' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
        <Link href="/cashier/dashboard" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          <ChevronLeft size={16} />
        </Link>
        <h1 className="page-title">Edit Batch Request</h1>
      </div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
        Edit your pending batch. Changes replace all existing items.
      </p>

      <form onSubmit={handleSubmit}>

        {/* Batch Header */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: '0.4rem' }}>Request Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleError(''); }}
                placeholder="e.g. New Request Item - Event WTT CORK"
                required
                style={{ ...INPUT_STYLE, height: '48px', fontSize: '1rem', borderColor: titleError ? 'rgba(122,46,31,0.5)' : undefined }}
              />
              {titleError && <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.3rem' }}>{titleError}</p>}
            </div>

            <div>
              <div className="label-caps" style={{ marginBottom: '0.75rem' }}>Request Type</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {REQUEST_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setRequestType(t.value)}
                    style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: `1px solid ${requestType === t.value ? 'var(--bg-dark)' : 'var(--border)'}`, background: requestType === t.value ? 'var(--bg-dark)' : 'transparent', color: requestType === t.value ? 'var(--accent-gold)' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: requestType === t.value ? 500 : 400, cursor: 'pointer', transition: 'all 200ms ease' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span className="section-title">Items</span>
              <span style={{ background: 'var(--bg-dark)', color: 'var(--accent-gold)', fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>
                {items.length}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                ← scroll right for printers, outlets & POS settings
              </span>
            </div>
            <button
              type="button"
              onClick={addRow}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}
            >
              <Plus size={13} /> Add Row
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ tableLayout: 'auto', minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>#</th>
                  {isUpdate && <th style={{ minWidth: '140px' }}>Code</th>}
                  <th style={{ minWidth: '180px' }}>Name</th>
                  {showCategoryCol && <th style={{ minWidth: '160px' }}>Category</th>}
                  {showCategoryCol && <th style={{ minWidth: '90px' }}>Dept</th>}
                  {needsPrice && <th style={{ minWidth: '105px' }}>Price (IDR)</th>}
                  {showCategoryCol && <th style={{ minWidth: '120px' }}>Folder</th>}
                  <th style={{ minWidth: '155px' }}>Printers</th>
                  <th style={{ minWidth: '140px' }}>Outlets</th>
                  <th style={{ minWidth: '72px' }}>POS</th>
                  <th style={{ width: '66px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => {
                  const hasError = Object.keys(row.errors).length > 0;
                  return (
                    <tr key={row._id} style={{ borderLeft: hasError ? '2px solid rgba(122,46,31,0.6)' : undefined, verticalAlign: 'top' }}>
                      <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, paddingTop: '0.6rem' }}>{idx + 1}</td>

                      {isUpdate && (
                        <td>
                          <input type="text" value={row.code} onChange={(e) => updateRow(idx, 'code', e.target.value)} placeholder="PLU code"
                            style={{ ...INPUT_STYLE, borderColor: row.errors.code ? 'rgba(122,46,31,0.5)' : undefined }} />
                          {row.errors.code && <p style={{ fontSize: '0.7rem', color: '#8B3A2A', margin: '2px 0 0' }}>{row.errors.code}</p>}
                        </td>
                      )}

                      <td>
                        <input type="text" value={row.name} onChange={(e) => updateRow(idx, 'name', e.target.value)} placeholder="Item name"
                          style={{ ...INPUT_STYLE, borderColor: row.errors.name ? 'rgba(122,46,31,0.5)' : undefined }} />
                        {row.errors.name && <p style={{ fontSize: '0.7rem', color: '#8B3A2A', margin: '2px 0 0' }}>{row.errors.name}</p>}
                      </td>

                      {showCategoryCol && (
                        <td>
                          <Combobox options={categoryOptions} value={row.category} onChange={(v) => updateRow(idx, 'category', v)} placeholder="Category..." searchPlaceholder="Search..." />
                        </td>
                      )}

                      {showCategoryCol && (
                        <td>
                          <input type="text" value={row.department} readOnly style={{ ...INPUT_STYLE, background: 'var(--bg-cream)', fontSize: '0.75rem' }} />
                        </td>
                      )}

                      {needsPrice && (
                        <td>
                          <input type="number" value={row.price} onChange={(e) => updateRow(idx, 'price', e.target.value)} placeholder="0"
                            style={{ ...INPUT_STYLE, borderColor: row.errors.price ? 'rgba(122,46,31,0.5)' : undefined }} />
                          {row.errors.price && <p style={{ fontSize: '0.7rem', color: '#8B3A2A', margin: '2px 0 0' }}>{row.errors.price}</p>}
                        </td>
                      )}

                      {showCategoryCol && (
                        <td>
                          <input type="text" value={row.folder} onChange={(e) => updateRow(idx, 'folder', e.target.value)} placeholder="Folder" style={INPUT_STYLE} />
                        </td>
                      )}

                      {/* Printers */}
                      <td>
                        <MultiSelect
                          options={availablePrinters}
                          value={row.printers}
                          onChange={(v) => updateRow(idx, 'printers', v)}
                          placeholder="Printers…"
                          error={row.errors.printers}
                        />
                      </td>

                      {/* Outlets */}
                      <td>
                        <MultiSelect
                          options={availableOutlets}
                          value={row.outlets}
                          onChange={(v) => updateRow(idx, 'outlets', v)}
                          placeholder="Outlets…"
                          error={row.errors.outlets}
                        />
                      </td>

                      {/* POS Settings */}
                      <td style={{ paddingTop: '0.5rem' }}>
                        {POS_FIELDS.map(({ key, abbr, full }) => (
                          <label key={key} title={full} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', cursor: 'pointer', marginBottom: '0.2rem', whiteSpace: 'nowrap' }}>
                            <Checkbox checked={row[key] as boolean} onCheckedChange={(v) => updateRow(idx, key, v)} />
                            <span style={{ color: 'var(--text-secondary)' }}>{abbr}</span>
                          </label>
                        ))}
                      </td>

                      {/* Actions */}
                      <td style={{ paddingTop: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          <button type="button" onClick={() => duplicateRow(idx)} title="Duplicate row"
                            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.25rem 0.4rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                            <Copy size={11} />
                          </button>
                          <button type="button" onClick={() => deleteRow(idx)} title={items.length <= 1 ? 'Cannot remove the last item' : 'Delete row'}
                            style={{ background: 'transparent', border: `1px solid ${items.length <= 1 ? 'var(--border)' : 'rgba(139,58,42,0.25)'}`, borderRadius: '3px', padding: '0.25rem 0.4rem', cursor: items.length <= 1 ? 'not-allowed' : 'pointer', color: items.length <= 1 ? 'var(--text-secondary)' : '#7A2E1F', display: 'flex', alignItems: 'center', opacity: items.length <= 1 ? 0.4 : 1 }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit bar */}
        <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{items.length}</strong> item{items.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.5rem', background: saving ? 'rgba(26,16,8,0.5)' : 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <Link
              href="/cashier/dashboard"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '0.625rem 1.125rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.875rem', textDecoration: 'none' }}
            >
              Cancel
            </Link>
          </div>
        </div>

      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
