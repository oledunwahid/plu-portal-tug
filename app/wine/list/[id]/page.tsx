'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ChevronLeft, Loader2, Pencil, AlertTriangle, Lock, History, Power,
} from 'lucide-react';
import { WINE_MESSAGES, formatVintage } from '@/lib/wine';
import { parsePriceLevels } from '@/lib/priceLevels';
import { CARD_SECTION_STYLE, formatRupiah, formatDateTime, splitList } from '@/components/wine/wineUi';

interface WineDetail {
  id: string;
  wineName: string;
  displayName: string | null;
  status: string;
  vintage: number | null;
  isNonVintage: boolean;
  abv: number | null;
  producerName: string | null;
  countryName: string | null;
  regionName: string | null;
  appellationName: string | null;
  classificationName: string | null;
  wineTypeName: string | null;
  categoryName: string | null;
  subCategory1Name: string | null;
  subCategory2Name: string | null;
  bottleSizeName: string | null;
  description: string | null;
  tastingNotes: string | null;
  foodPairing: string | null;
  servingTemperature: string | null;
  internalNotes: string | null;
  costPerBottle: number | null;
  legacyWineCode: string | null;
  sourceRequestId: string | null;
  masterItemCode: string | null;
  masterItemName: string | null;
  createdAt: string;
  updatedAt: string;
  duplicateIndication: boolean;
  master: {
    id: string; code: string; name: string; category: string; department: string;
    price: number | null; plu: string | null; barcode: string | null; uom: string | null;
    folder: string | null; outlets: string | null; priceLevels: string | null;
    active: boolean; serviceCharge: boolean; tax1: boolean; tax2: boolean;
    noDiscount: boolean; updatedAt: string;
  } | null;
}

interface Varietal { id: string; varietalId: string; varietalName: string | null; percentage: number | null }
interface AuditLog {
  id: string; action: string; fieldName: string | null; oldValue: string | null;
  newValue: string | null; performedBy: string | null; performedAt: string;
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card" style={CARD_SECTION_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem', gap: '1rem' }}>
        <h2 className="section-title" style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="label-caps" style={{ fontSize: '0.58rem', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500, fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-word' }}>
        {value === null || value === undefined || value === '' ? '—' : value}
      </div>
    </div>
  );
}

function Grid({ children, columns = 4 }: { children: React.ReactNode; columns?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: '0.9rem' }}>
      {children}
    </div>
  );
}

function BoolPill({ value }: { value: boolean }) {
  return (
    <span style={{
      fontSize: '0.68rem', padding: '1px 6px', borderRadius: '3px', fontWeight: 600,
      background: value ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
      color: value ? '#2D4A2E' : '#7A2E1F',
      border: `1px solid ${value ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}`,
    }}>
      {value ? 'Yes' : 'No'}
    </span>
  );
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Wine dibuat',
  UPDATE: 'Data diubah',
  STATUS_CHANGE: 'Status diubah',
  PUBLISH: 'Publish dari request',
  IMPORT: 'Import legacy',
};

export default function WineDetailPage({ params }: { params: { id: string } }) {
  const [wine, setWine] = useState<WineDetail | null>(null);
  const [varietals, setVarietals] = useState<Varietal[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [canViewCost, setCanViewCost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wines/${params.id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWine(data.wine);
      setVarietals(data.varietals ?? []);
      setAuditLogs(data.auditLogs ?? []);
      setCanViewCost(Boolean(data.canViewCost));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus() {
    if (!wine) return;
    const next = wine.status === 'Active' ? 'Inactive' : 'Active';
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/wines/${wine.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Gagal mengubah status.');
      toast.success(`Status wine diubah menjadi ${next}.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status.');
    } finally {
      setStatusBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Wine tidak ditemukan.</p>
        <Link href="/wine/list" className="btn-secondary" style={{ textDecoration: 'none' }}>Kembali ke Wine List</Link>
      </div>
    );
  }

  if (failed || !wine) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9rem', color: '#8B3A2A', marginBottom: '1rem' }}>{WINE_MESSAGES.loadFailed}</p>
        <button type="button" onClick={load} className="btn-secondary">Coba kembali</button>
      </div>
    );
  }

  const priceLevels = parsePriceLevels(wine.master?.priceLevels);
  const outlets = splitList(wine.master?.outlets);
  // Availability is derived from the Master Item's outlet list + price levels: it means the wine is
  // in use at that outlet, NOT that stock is on hand.
  const outletRows = outlets.map((code) => {
    const level = priceLevels.entries.find((entry) =>
      splitList(entry.outletGroup).includes(code) || entry.outletGroup === code);
    return {
      code,
      price: level?.price ?? wine.master?.price ?? null,
      priceLevel: level ? `${level.outletType || '—'}` : null,
      folder: wine.master?.folder ?? null,
      active: wine.master?.active ?? false,
      updatedAt: wine.master?.updatedAt ?? null,
    };
  });

  return (
    <div>
      <Link
        href="/wine/list"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '0.75rem' }}
      >
        <ChevronLeft size={13} /> Wine List
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>{wine.wineName}</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            {[
              wine.producerName,
              formatVintage(wine.vintage, wine.isNonVintage),
              wine.bottleSizeName,
              wine.wineTypeName,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={statusBusy}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {statusBusy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Power size={13} />}
            {wine.status === 'Active' ? 'Set Inactive' : 'Set Active'}
          </button>
          <Link
            href={`/wine/list/${wine.id}/edit`}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
          >
            <Pencil size={13} /> Edit
          </Link>
        </div>
      </div>

      {/* Master Item inactive warning (edge case 8) */}
      {wine.master && !wine.master.active && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1rem',
            background: 'rgba(139,58,42,0.07)', border: '1px solid rgba(139,58,42,0.2)',
            borderRadius: '0.35rem', padding: '0.65rem 0.8rem', fontSize: '0.8rem', color: '#8B3A2A',
          }}
        >
          <AlertTriangle size={14} />
          Master Item <strong>{wine.master.code}</strong> saat ini <strong>Inactive</strong> di registry
          Quinos. Menonaktifkan Wine Master tidak otomatis menonaktifkan Master Item, dan sebaliknya.
        </div>
      )}
      {!wine.master && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1rem',
            background: 'rgba(139,58,42,0.07)', border: '1px solid rgba(139,58,42,0.2)',
            borderRadius: '0.35rem', padding: '0.65rem 0.8rem', fontSize: '0.8rem', color: '#8B3A2A',
          }}
        >
          <AlertTriangle size={14} />
          Master Item terkait tidak ditemukan di registry (kode tersimpan: {wine.masterItemCode ?? '—'}).
          Harga, barcode dan outlet tidak dapat ditampilkan.
        </div>
      )}
      {wine.duplicateIndication && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1rem',
            background: 'rgba(184,134,11,0.07)', border: '1px solid rgba(184,134,11,0.22)',
            borderRadius: '0.35rem', padding: '0.65rem 0.8rem', fontSize: '0.8rem', color: '#8B6914',
          }}
        >
          <AlertTriangle size={14} />
          Wine lain memiliki nama, vintage dan bottle size yang sama - periksa kemungkinan duplikat.
        </div>
      )}

      {/* A - Basic information */}
      <Section title="Basic Information">
        <Grid>
          <Field label="Status" value={wine.status} />
          <Field label="Wine Name" value={wine.wineName} />
          <Field label="Display Name" value={wine.displayName} />
          <Field label="Producer" value={wine.producerName} />
          <Field label="Vintage" value={formatVintage(wine.vintage, wine.isNonVintage)} />
          <Field label="Non-Vintage" value={wine.isNonVintage ? 'Yes' : 'No'} />
          <Field label="Country" value={wine.countryName} />
          <Field label="Region" value={wine.regionName} />
          <Field label="Appellation" value={wine.appellationName} />
          <Field label="Classification" value={wine.classificationName} />
          <Field
            label="Varietal"
            value={varietals.length === 0 ? null : varietals
              .map((v) => (v.percentage != null ? `${v.varietalName ?? '—'} ${v.percentage}%` : v.varietalName ?? '—'))
              .join(', ')}
          />
          <Field label="Wine Type" value={wine.wineTypeName} />
          <Field label="Category" value={wine.categoryName} />
          <Field label="Sub Category 1" value={wine.subCategory1Name} />
          <Field label="Sub Category 2" value={wine.subCategory2Name} />
          <Field label="Bottle Size" value={wine.bottleSizeName} />
          <Field label="ABV" value={wine.abv != null ? `${wine.abv}%` : null} />
          <Field label="Legacy Wine Code" value={wine.legacyWineCode} mono />
        </Grid>
      </Section>

      {/* B - PLU information, read-only from Master Item */}
      <Section
        title="PLU Information"
        action={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            <Lock size={11} /> Read-only dari Master Item
          </span>
        }
      >
        <Grid>
          <Field label="Master Item" value={wine.master?.name ?? wine.masterItemName} />
          <Field label="PLU Code" value={wine.master?.code ?? wine.masterItemCode} mono />
          <Field label="Barcode" value={wine.master?.barcode} mono />
          <Field label="PLU / SAP Reference" value={wine.master?.plu} mono />
          <Field label="Department" value={wine.master?.department} />
          <Field label="Category" value={wine.master?.category} />
          <Field label="Folder" value={wine.master?.folder} />
          <Field label="UOM" value={wine.master?.uom} />
        </Grid>
        {wine.master && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.9rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Tax 1 <BoolPill value={wine.master.tax1} />
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Tax 2 <BoolPill value={wine.master.tax2} />
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Service Charge <BoolPill value={wine.master.serviceCharge} />
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              No Discount <BoolPill value={wine.master.noDiscount} />
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Master Item Active <BoolPill value={wine.master.active} />
            </span>
          </div>
        )}
        {wine.sourceRequestId && (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.85rem', marginBottom: 0 }}>
            Dipublikasikan dari request{' '}
            <span style={{ fontFamily: 'monospace' }}>{wine.sourceRequestId.slice(0, 8).toUpperCase()}</span>
          </p>
        )}
      </Section>

      {/* C - Commercial */}
      <Section title="Commercial Information">
        <Grid>
          <Field label="Selling Price (Master Item)" value={formatRupiah(wine.master?.price ?? null)} />
          <Field
            label="Cost per Bottle"
            value={canViewCost ? formatRupiah(wine.costPerBottle) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                <Lock size={11} /> {WINE_MESSAGES.costForbidden}
              </span>
            )}
          />
          <Field label="Last Price Update (Master Item)" value={formatDateTime(wine.master?.updatedAt)} />
          <Field label="Wine Last Updated" value={formatDateTime(wine.updatedAt)} />
        </Grid>
        {priceLevels.entries.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div className="label-caps" style={{ marginBottom: '0.4rem' }}>Price Levels</div>
            <div className="card" style={{ overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>Outlet Type</th>
                    <th>Outlet Group</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {priceLevels.entries.map((entry, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '0.76rem' }}>{entry.outletType || '—'}</td>
                      <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{entry.outletGroup || '—'}</td>
                      <td style={{ fontSize: '0.76rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {entry.price.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      {/* D - Outlet availability */}
      <Section title="Outlet Availability">
        <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
          Availability berarti wine aktif/dipakai di outlet tersebut - bukan jumlah stok fisik.
        </p>
        {outletRows.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#8B3A2A', margin: 0 }}>
            Wine Master aktif namun tidak memiliki outlet aktif pada Master Item.
          </p>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>Outlet</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Selling Price</th>
                  <th>Folder</th>
                  <th>Price Level</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {outletRows.map((row) => (
                  <tr key={row.code}>
                    <td style={{ fontSize: '0.78rem', fontWeight: 500 }}>{row.code}</td>
                    <td style={{ fontSize: '0.74rem', color: row.active ? '#2D4A2E' : '#8B3A2A' }}>
                      {row.active ? 'Active' : 'Inactive'}
                    </td>
                    <td style={{ fontSize: '0.78rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatRupiah(row.price)}
                    </td>
                    <td style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{row.folder ?? '—'}</td>
                    <td style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{row.priceLevel ?? 'Flat price'}</td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{formatDateTime(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* E - Additional wine information */}
      <Section title="Additional Wine Information">
        <Grid columns={2}>
          <Field label="Description" value={wine.description} />
          <Field label="Tasting Notes" value={wine.tastingNotes} />
          <Field label="Food Pairing" value={wine.foodPairing} />
          <Field label="Serving Temperature" value={wine.servingTemperature} />
          <Field label="Internal Notes" value={wine.internalNotes} />
        </Grid>
      </Section>

      {/* F - Audit history */}
      <Section
        title="Audit History"
        action={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            <History size={11} /> Tidak dapat diubah atau dihapus
          </span>
        }
      >
        {auditLogs.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Belum ada riwayat perubahan.</p>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Action</th>
                  <th>Field</th>
                  <th>Old Value</th>
                  <th>New Value</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.performedAt)}
                    </td>
                    <td style={{ fontSize: '0.75rem', fontWeight: 500 }}>{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{log.fieldName ?? '—'}</td>
                    <td style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', maxWidth: '180px', wordBreak: 'break-word' }}>
                      {log.oldValue ?? '—'}
                    </td>
                    <td style={{ fontSize: '0.74rem', maxWidth: '180px', wordBreak: 'break-word' }}>{log.newValue ?? '—'}</td>
                    <td style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {log.performedBy ? log.performedBy.slice(0, 8) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem', marginBottom: 0 }}>
          Dibuat {formatDateTime(wine.createdAt)} · Terakhir diubah {formatDateTime(wine.updatedAt)}
        </p>
      </Section>

      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
