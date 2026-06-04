'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelect } from '@/components/ui/multi-select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Copy, ChevronLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { PLUCodeSearch } from '@/components/PLUCodeSearch';
import type { PLUSearchResult } from '@/components/PLUCodeSearch';

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NEW_ITEM: 'New Item',
  UPDATE_PRICE: 'Update Price',
  UPDATE_NAME: 'Update Name',
  UPDATE_PRINTER: 'Change Printer',
  UPDATE_FULL: 'Other Update',
  REMOVE_PLU: 'Remove PLU',
};

interface ConfigCategory {
  id: string; name: string; department: string; departmentCode: number; categoryCode: number; isActive: boolean;
}
interface ConfigPrinter {
  id: string; name: string; group: string; isActive: boolean;
}

interface ItemRow {
  _id: string;
  code: string;
  name: string;
  category: string;
  department: string;
  price: string;
  folder: string;
  barcode: string;
  serviceCharge: boolean;
  tax1: boolean;
  tax2: boolean;
  noDiscount: boolean;
  hideReceipt: boolean;
  salesDef: string;
  printers: string[];
  outlets: string[];
  remarks: string;
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

function formatPriceDisplay(raw: string): string {
  if (!raw) return '';
  const n = parseInt(raw, 10);
  return isNaN(n) ? '' : n.toLocaleString('id-ID');
}

function makeDefaultRow(): ItemRow {
  return {
    _id: uid(), code: '', name: '', category: '', department: '',
    price: '', folder: '', barcode: '',
    serviceCharge: true, tax1: true, tax2: true, noDiscount: true, hideReceipt: false,
    salesDef: 'SALES', printers: [], outlets: [], remarks: '', errors: {},
  };
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', height: '34px', border: '1px solid var(--input-border)',
  borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)',
  padding: '0 0.625rem', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
};

async function fetchWithRetry<T>(url: string): Promise<T> {
  const doFetch = async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  };
  try { return await doFetch(); }
  catch { return await doFetch(); }
}

export default function BatchEditPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const batchId = params.id as string;

  const sessionUser = session?.user as any;
  const outletGroup = sessionUser?.outletGroup ?? '';

  const [configCategories, setConfigCategories] = useState<ConfigCategory[]>([]);
  const [configPrinters, setConfigPrinters] = useState<ConfigPrinter[]>([]);
  const [configOutlets, setConfigOutlets] = useState<string[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (!outletGroup) return;
    setConfigLoading(true);
    setConfigError(null);
    Promise.all([
      fetchWithRetry<ConfigCategory[]>(`/api/config/categories?activeOnly=true`),
      fetchWithRetry<ConfigPrinter[]>(`/api/config/printers?group=${encodeURIComponent(outletGroup)}&activeOnly=true`),
      fetchWithRetry<{ code: string }[]>(`/api/config/outlets?group=${encodeURIComponent(outletGroup)}&activeOnly=true`),
    ])
      .then(([cats, printers, outlets]) => {
        setConfigCategories(cats);
        setConfigPrinters(printers);
        setConfigOutlets(outlets.map((o) => o.code));
      })
      .catch(() => setConfigError('Gagal memuat data konfigurasi. Coba muat ulang halaman.'))
      .finally(() => setConfigLoading(false));
  }, [outletGroup]);

  const categoryOptions = configCategories.map((c) => ({ value: c.name, label: c.name, group: c.department }));
  const availablePrinters = configPrinters.map((p) => p.name);

  const [pageLoading, setPageLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [requestType, setRequestType] = useState('NEW_ITEM');
  const [items, setItems] = useState<ItemRow[]>([makeDefaultRow()]);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState('');

  const isRemovePLU = requestType === 'REMOVE_PLU';
  const isUpdate = requestType !== 'NEW_ITEM';
  const showNameCol = requestType === 'NEW_ITEM' || requestType === 'UPDATE_NAME' || requestType === 'UPDATE_FULL';
  const showCategoryCol = requestType === 'NEW_ITEM' || requestType === 'UPDATE_FULL';
  const showPriceCol = requestType === 'NEW_ITEM' || requestType === 'UPDATE_PRICE' || requestType === 'UPDATE_FULL';
  const showFolderCol = requestType === 'NEW_ITEM' || requestType === 'UPDATE_FULL';
  const showBarcodeColumn = showCategoryCol && items.some((r) => r.department === 'WINE');
  const showPrintersCol = requestType === 'NEW_ITEM' || requestType === 'UPDATE_PRINTER' || requestType === 'UPDATE_FULL';
  const showOutletsCol = requestType === 'NEW_ITEM' || requestType === 'UPDATE_FULL';
  const showPOSCol = requestType === 'NEW_ITEM' || requestType === 'UPDATE_FULL';

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
        setRequestType(data.requestType);
        const loaded: ItemRow[] = (data.items as any[]).map((item: any) => ({
          _id: uid(),
          code: item.code ?? '',
          name: item.name,
          category: item.category,
          department: item.department,
          price: item.price != null ? String(item.price) : '',
          folder: item.folder ?? '',
          barcode: item.barcode ?? '',
          serviceCharge: item.serviceCharge,
          tax1: item.tax1,
          tax2: item.tax2,
          noDiscount: item.noDiscount,
          hideReceipt: item.hideReceipt,
          salesDef: item.salesDef ?? 'SALES',
          printers: item.printers ? item.printers.split(';').filter(Boolean) : [],
          outlets: item.outlets ? item.outlets.split(';').filter(Boolean) : [],
          remarks: item.remarks ?? '',
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
      return [...prev, { ...last, _id: uid(), code: '', name: '', remarks: '', errors: {} }];
    });
  }, []);

  function duplicateRow(idx: number) {
    setItems((prev) => {
      const copy: ItemRow = { ...prev[idx], _id: uid(), name: '', remarks: '', errors: {} };
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
      if (key === 'category') {
        updated.department = configCategories.find((c) => c.name === (value as string))?.department ?? '';
        if (updated.department !== 'WINE') updated.barcode = '';
      }
      return updated;
    }));
  }

  function handleCodeSearchChange(idx: number, code: string) {
    setItems((prev) => prev.map((r, i) => i !== idx ? r : { ...r, code, codeIsAutoGenerated: false, errors: { ...r.errors, code: undefined } } as ItemRow));
  }

  function handleCodeItemSelect(idx: number, item: PLUSearchResult) {
    setItems((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, code: item.code, errors: { ...r.errors, code: undefined } };
      if (isRemovePLU) {
        updated.name = item.name;
        updated.folder = item.folder ?? '';
      }
      return updated;
    }));
  }

  function validate(): boolean {
    let valid = true;
    const errorRows: number[] = [];
    if (!title.trim()) { setTitleError('Batch title is required'); valid = false; }
    const updatedItems = items.map((row, idx) => {
      const errors: Record<string, string> = {};
      if (requestType === 'NEW_ITEM') {
        if (!row.name.trim()) errors.name = 'Name required';
        if (row.printers.length === 0) errors.printers = 'Select printer';
        if (row.outlets.length === 0) errors.outlets = 'Select outlet';
      } else if (requestType === 'UPDATE_PRICE') {
        if (!row.code.trim()) errors.code = 'Code required';
        if (!row.price || Number(row.price) <= 0) errors.price = 'Price required';
      } else if (requestType === 'UPDATE_NAME') {
        if (!row.code.trim()) errors.code = 'Code required';
        if (!row.name.trim()) errors.name = 'Name required';
      } else if (requestType === 'UPDATE_PRINTER') {
        if (!row.code.trim()) errors.code = 'Code required';
        if (row.printers.length === 0) errors.printers = 'Select printer';
      } else if (requestType === 'UPDATE_FULL') {
        if (!row.code.trim()) errors.code = 'Code required';
      } else if (requestType === 'REMOVE_PLU') {
        if (!row.code.trim()) errors.code = 'Code required';
        if (!row.remarks.trim()) errors.remarks = 'Alasan penghapusan harus diisi';
      }
      if (Object.keys(errors).length > 0) { valid = false; errorRows.push(idx + 1); }
      return { ...row, errors };
    });
    setItems(updatedItems);
    if (!valid) {
      if (errorRows.length > 0) toast.error(`Periksa baris: ${errorRows.join(', ')}`);
      else toast.error('Judul batch harus diisi');
    }
    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { toast.error('Tambahkan minimal 1 item sebelum submit'); return; }
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        requestType,
        items: items.map((row) => ({
          code: row.code || undefined,
          name: row.name.trim() || '',
          category: row.category || '',
          department: row.department || '',
          price: parseInt(row.price || '0', 10),
          folder: row.folder || undefined,
          serviceCharge: row.serviceCharge,
          tax1: row.tax1,
          tax2: row.tax2,
          noDiscount: row.noDiscount,
          hideReceipt: row.hideReceipt,
          printers: row.printers,
          outlets: row.outlets,
          salesDef: row.salesDef || 'SALES',
          barcode: row.department === 'WINE' ? row.barcode || undefined : undefined,
          remarks: row.remarks || undefined,
        })),
      };
      const res = await fetch(`/api/batches/${batchId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
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

  const configBanner = configLoading ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', background: 'var(--bg-cream)', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Memuat data konfigurasi…</span>
    </div>
  ) : configError ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', background: 'rgba(122,46,31,0.07)', border: '1px solid rgba(122,46,31,0.2)', marginBottom: '0.75rem' }}>
      <AlertTriangle size={13} style={{ color: '#8B3A2A' }} />
      <span style={{ fontSize: '0.78rem', color: '#8B3A2A' }}>Gagal memuat data konfigurasi. Coba muat ulang halaman.</span>
    </div>
  ) : null;

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

      {configBanner}

      <form onSubmit={handleSubmit}>

        {/* Batch Header */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: '0.4rem' }}>Request Title</label>
              <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); setTitleError(''); }} required
                style={{ ...INPUT_STYLE, height: '48px', fontSize: '1rem', borderColor: titleError ? 'rgba(122,46,31,0.5)' : undefined }} />
              {titleError && <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.3rem' }}>{titleError}</p>}
            </div>
            <div>
              <div className="label-caps" style={{ marginBottom: '0.75rem' }}>Request Type</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1rem', background: 'var(--bg-dark)', color: 'var(--accent-gold)', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 500 }}>
                {REQUEST_TYPE_LABELS[requestType] ?? requestType}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
                Request type cannot be changed after creation.
              </p>
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
              {!isRemovePLU && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  ← scroll right for printers, outlets & POS settings
                </span>
              )}
            </div>
            <button type="button" onClick={addRow}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
              <Plus size={13} /> Add Row
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ tableLayout: 'auto', minWidth: isRemovePLU ? '600px' : '900px' }}>
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>#</th>
                  {isRemovePLU && <th style={{ minWidth: '200px' }}>PLU Code</th>}
                  {isRemovePLU && <th style={{ minWidth: '180px' }}>Item Name</th>}
                  {isRemovePLU && <th style={{ minWidth: '120px' }}>Folder</th>}
                  {isRemovePLU && <th style={{ minWidth: '200px' }}>Remarks</th>}
                  {!isRemovePLU && isUpdate && <th style={{ minWidth: '200px' }}>Code</th>}
                  {!isRemovePLU && showNameCol && <th style={{ minWidth: '180px' }}>Name</th>}
                  {!isRemovePLU && showCategoryCol && <th style={{ minWidth: '160px' }}>Category</th>}
                  {!isRemovePLU && showCategoryCol && <th style={{ minWidth: '90px' }}>Dept</th>}
                  {!isRemovePLU && showPriceCol && <th style={{ minWidth: '170px' }}>Price (IDR)</th>}
                  {!isRemovePLU && showBarcodeColumn && <th style={{ minWidth: '100px' }}>Barcode</th>}
                  {!isRemovePLU && showFolderCol && <th style={{ minWidth: '120px' }}>Folder</th>}
                  {!isRemovePLU && showPrintersCol && <th style={{ minWidth: '155px' }}>Printers</th>}
                  {!isRemovePLU && showOutletsCol && <th style={{ minWidth: '140px' }}>Outlets</th>}
                  {!isRemovePLU && showPOSCol && <th style={{ minWidth: '110px' }}>Sales Def</th>}
                  {!isRemovePLU && showPOSCol && <th style={{ minWidth: '150px' }}>POS</th>}
                  <th style={{ width: '66px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => {
                  const hasError = Object.keys(row.errors).length > 0;
                  return (
                    <tr key={row._id} style={{ borderLeft: hasError ? '2px solid rgba(122,46,31,0.6)' : undefined, verticalAlign: 'top' }}>
                      <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, paddingTop: '0.6rem' }}>{idx + 1}</td>

                      {isRemovePLU && (
                        <>
                          <td>
                            <PLUCodeSearch value={row.code} onChange={(code) => handleCodeSearchChange(idx, code)} onItemSelect={(item) => handleCodeItemSelect(idx, item)} placeholder="Search PLU code..." error={row.errors.code} />
                            {row.errors.code && <p style={{ fontSize: '0.7rem', color: '#8B3A2A', margin: '2px 0 0' }}>{row.errors.code}</p>}
                          </td>
                          <td>
                            <input type="text" value={row.name} readOnly placeholder="Auto-populated" style={{ ...INPUT_STYLE, background: 'var(--bg-cream)', fontSize: '0.75rem' }} />
                          </td>
                          <td>
                            <input type="text" value={row.folder} readOnly placeholder="Auto-populated" style={{ ...INPUT_STYLE, background: 'var(--bg-cream)', fontSize: '0.75rem' }} />
                          </td>
                          <td>
                            <input type="text" value={row.remarks} onChange={(e) => updateRow(idx, 'remarks', e.target.value)} placeholder="Alasan penghapusan..."
                              style={{ ...INPUT_STYLE, borderColor: row.errors.remarks ? 'rgba(122,46,31,0.5)' : undefined }} />
                            {row.errors.remarks && <p style={{ fontSize: '0.7rem', color: '#8B3A2A', margin: '2px 0 0' }}>{row.errors.remarks}</p>}
                          </td>
                        </>
                      )}

                      {!isRemovePLU && isUpdate && (
                        <td>
                          <PLUCodeSearch value={row.code} onChange={(code) => handleCodeSearchChange(idx, code)} onItemSelect={(item) => handleCodeItemSelect(idx, item)} placeholder="PLU code" error={row.errors.code} />
                          {row.errors.code && <p style={{ fontSize: '0.7rem', color: '#8B3A2A', margin: '2px 0 0' }}>{row.errors.code}</p>}
                        </td>
                      )}

                      {!isRemovePLU && showNameCol && (
                        <td>
                          <input type="text" value={row.name} onChange={(e) => updateRow(idx, 'name', e.target.value)} placeholder="Item name"
                            style={{ ...INPUT_STYLE, borderColor: row.errors.name ? 'rgba(122,46,31,0.5)' : undefined }} />
                          {row.errors.name && <p style={{ fontSize: '0.7rem', color: '#8B3A2A', margin: '2px 0 0' }}>{row.errors.name}</p>}
                        </td>
                      )}

                      {!isRemovePLU && showCategoryCol && (
                        <td><Combobox options={categoryOptions} value={row.category} onChange={(v) => updateRow(idx, 'category', v)} placeholder="Category..." searchPlaceholder="Search..." /></td>
                      )}
                      {!isRemovePLU && showCategoryCol && (
                        <td><input type="text" value={row.department} readOnly style={{ ...INPUT_STYLE, background: 'var(--bg-cream)', fontSize: '0.75rem' }} /></td>
                      )}

                      {!isRemovePLU && showPriceCol && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>Rp</span>
                            <input type="text" inputMode="numeric" value={formatPriceDisplay(row.price)} onChange={(e) => updateRow(idx, 'price', e.target.value.replace(/\D/g, ''))} placeholder="0"
                              style={{ ...INPUT_STYLE, flex: 1, minWidth: '140px', borderColor: row.errors.price ? 'rgba(122,46,31,0.5)' : undefined }} />
                          </div>
                          {row.errors.price && <p style={{ fontSize: '0.7rem', color: '#8B3A2A', margin: '2px 0 0' }}>{row.errors.price}</p>}
                        </td>
                      )}

                      {!isRemovePLU && showBarcodeColumn && (
                        <td>{row.department === 'WINE' ? <input type="text" value={row.barcode} onChange={(e) => updateRow(idx, 'barcode', e.target.value)} placeholder="Barcode" style={INPUT_STYLE} /> : null}</td>
                      )}
                      {!isRemovePLU && showFolderCol && (
                        <td><input type="text" value={row.folder} onChange={(e) => updateRow(idx, 'folder', e.target.value)} placeholder="Folder" style={INPUT_STYLE} /></td>
                      )}
                      {!isRemovePLU && showPrintersCol && (
                        <td><MultiSelect options={availablePrinters} value={row.printers} onChange={(v) => updateRow(idx, 'printers', v)} placeholder="Printers…" error={row.errors.printers} /></td>
                      )}
                      {!isRemovePLU && showOutletsCol && (
                        <td><MultiSelect options={configOutlets} value={row.outlets} onChange={(v) => updateRow(idx, 'outlets', v)} placeholder="Outlets…" error={row.errors.outlets} /></td>
                      )}
                      {!isRemovePLU && showPOSCol && (
                        <td>
                          <select value={row.salesDef} onChange={(e) => updateRow(idx, 'salesDef', e.target.value)} style={INPUT_STYLE}>
                            <option value="SALES">SALES</option>
                            <option value="MODIFIER">MODIFIER</option>
                          </select>
                        </td>
                      )}
                      {!isRemovePLU && showPOSCol && (
                        <td>
                          <MultiSelect
                            options={POS_FIELDS.map((f) => f.full)}
                            value={POS_FIELDS.filter((f) => row[f.key] as boolean).map((f) => f.full)}
                            onChange={(selected) => {
                              setItems((prev) => prev.map((r, i) => {
                                if (i !== idx) return r;
                                const updates: Partial<ItemRow> = {};
                                POS_FIELDS.forEach(({ key, full }) => { (updates as any)[key] = selected.includes(full); });
                                return { ...r, ...updates };
                              }));
                            }}
                            placeholder="POS Settings..."
                          />
                        </td>
                      )}

                      <td style={{ paddingTop: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          <button type="button" onClick={() => duplicateRow(idx)} title="Duplicate row"
                            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.25rem 0.4rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                            <Copy size={11} />
                          </button>
                          <button type="button" onClick={() => deleteRow(idx)}
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
            <button type="submit" disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.5rem', background: saving ? 'rgba(26,16,8,0.5)' : 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <Link href="/cashier/dashboard" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.625rem 1.125rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.875rem', textDecoration: 'none' }}>
              Cancel
            </Link>
          </div>
        </div>

      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
