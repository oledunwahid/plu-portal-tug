'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Lock, AlertTriangle, Database } from 'lucide-react';
import { validateWineFields, parseWineNumber, WINE_MESSAGES } from '@/lib/wine';
import { parsePriceLevels } from '@/lib/priceLevels';
import { useWineMasterData } from './useWineMasterData';
import { WineSelect } from './WineSelect';
import { DuplicateWarning, type DuplicatePayload } from './DuplicateWarning';
import { MasterItemPicker, type MasterItemCandidate } from './MasterItemPicker';
import { WINE_FIELD_STYLE, WINE_TEXTAREA_STYLE, CARD_SECTION_STYLE, formatRupiah, splitList } from './wineUi';

export interface WineFormMasterInfo {
  id: string;
  code: string;
  name: string;
  category: string;
  department: string;
  price: number | null;
  barcode: string | null;
  folder: string | null;
  uom: string | null;
  outlets: string | null;
  priceLevels: string | null;
  active: boolean;
  serviceCharge: boolean;
  tax1: boolean;
  tax2: boolean;
  noDiscount: boolean;
}

export interface WineFormValues {
  wineName: string;
  displayName: string;
  producerId: string | null;
  countryId: string | null;
  regionId: string | null;
  appellationId: string | null;
  classificationId: string | null;
  wineTypeId: string | null;
  categoryId: string | null;
  subCategory1Id: string | null;
  subCategory2Id: string | null;
  bottleSizeId: string | null;
  vintageText: string;
  isNonVintage: boolean;
  abvText: string;
  description: string;
  tastingNotes: string;
  foodPairing: string;
  servingTemperature: string;
  internalNotes: string;
  costText: string;
  status: 'Active' | 'Inactive';
  varietals: { varietalId: string; percentageText: string }[];
}

export function emptyWineFormValues(): WineFormValues {
  return {
    wineName: '', displayName: '',
    producerId: null, countryId: null, regionId: null, appellationId: null,
    classificationId: null, wineTypeId: null, categoryId: null,
    subCategory1Id: null, subCategory2Id: null, bottleSizeId: null,
    vintageText: '', isNonVintage: false, abvText: '',
    description: '', tastingNotes: '', foodPairing: '', servingTemperature: '', internalNotes: '',
    costText: '', status: 'Active', varietals: [],
  };
}

function Section({ step, title, subtitle, children }: {
  step: number; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="card" style={CARD_SECTION_STYLE}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: subtitle ? '0.2rem' : '0.9rem' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.1em' }}>
          {String(step).padStart(2, '0')}
        </span>
        <h2 className="section-title" style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h2>
      </div>
      {subtitle && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.9rem' }}>{subtitle}</p>
      )}
      {children}
    </div>
  );
}

function Grid({ children, columns = 2 }: { children: React.ReactNode; columns?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: '0.85rem' }}>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, error, required, placeholder, maxLength, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; required?: boolean; placeholder?: string; maxLength?: number; hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <label className="label-caps">
        {label}
        {required && <span style={{ color: '#8B3A2A', marginLeft: '0.2rem' }}>*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{ ...WINE_FIELD_STYLE, borderColor: error ? '#8B3A2A' : 'var(--input-border)' }}
      />
      {hint && !error && <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>{hint}</p>}
      {error && <p style={{ fontSize: '0.72rem', color: '#8B3A2A', margin: 0 }}>{error}</p>}
    </div>
  );
}

function ReadOnlyField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="label-caps" style={{ fontSize: '0.58rem', marginBottom: '0.2rem' }}>{label}</div>
      <div
        style={{
          fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500,
          fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-word',
        }}
      >
        {value ?? '—'}
      </div>
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

export interface WineFormSubmitPayload {
  masterItemId: string;
  wineName: string;
  displayName: string | null;
  producerId: string | null;
  countryId: string | null;
  regionId: string | null;
  appellationId: string | null;
  classificationId: string | null;
  wineTypeId: string | null;
  categoryId: string | null;
  subCategory1Id: string | null;
  subCategory2Id: string | null;
  bottleSizeId: string | null;
  vintage: number | null;
  isNonVintage: boolean;
  abv: number | null;
  description: string | null;
  tastingNotes: string | null;
  foodPairing: string | null;
  servingTemperature: string | null;
  internalNotes: string | null;
  costPerBottle: number | null;
  status: 'Active' | 'Inactive';
  varietals: { varietalId: string; percentage: number | null }[];
  acknowledgeDuplicate: boolean;
}

/**
 * The one wine editor, shared by Add Wine, Edit Wine and Publish-from-request. Read-only PLU fields
 * always come from the linked Master Item and are rendered as text, never inputs - selling price, PLU
 * code, barcode, folder and outlets cannot be edited from the Wine List by design.
 */
export function WineForm({
  mode,
  master,
  initialValues,
  canViewCost,
  onSelectMaster,
  submit,
  onSaved,
  cancelHref,
  submitLabel,
  successMessage,
}: {
  mode: 'create' | 'edit' | 'publish';
  master: WineFormMasterInfo | null;
  initialValues?: WineFormValues;
  canViewCost: boolean;
  onSelectMaster?: (item: MasterItemCandidate) => void;
  submit: (payload: WineFormSubmitPayload) => Promise<Response>;
  onSaved?: (data: unknown) => void;
  cancelHref: string;
  submitLabel: string;
  successMessage: string;
}) {
  const router = useRouter();
  const masterData = useWineMasterData();
  const [values, setValues] = useState<WineFormValues>(initialValues ?? emptyWineFormValues());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatePayload | null>(null);

  function set<K extends keyof WineFormValues>(key: K, value: WineFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: '' } : e));
  }

  const priceLevels = useMemo(() => parsePriceLevels(master?.priceLevels), [master?.priceLevels]);
  const outletList = useMemo(() => splitList(master?.outlets), [master?.outlets]);

  function buildPayload(acknowledgeDuplicate: boolean): WineFormSubmitPayload | null {
    if (!master) {
      setErrors((e) => ({ ...e, masterItemId: WINE_MESSAGES.masterItemRequired }));
      return null;
    }
    const vintage = values.isNonVintage
      ? null
      : values.vintageText.trim() ? Number(values.vintageText.trim()) : null;
    const abv = values.abvText.trim() ? parseWineNumber(values.abvText) : null;
    const cost = values.costText.trim() ? parseWineNumber(values.costText) : null;

    const payload: WineFormSubmitPayload = {
      masterItemId: master.id,
      wineName: values.wineName.trim(),
      displayName: values.displayName.trim() || null,
      producerId: values.producerId,
      countryId: values.countryId,
      regionId: values.regionId,
      appellationId: values.appellationId,
      classificationId: values.classificationId,
      wineTypeId: values.wineTypeId,
      categoryId: values.categoryId,
      subCategory1Id: values.subCategory1Id,
      subCategory2Id: values.subCategory2Id,
      bottleSizeId: values.bottleSizeId,
      vintage: Number.isFinite(vintage) ? vintage : null,
      isNonVintage: values.isNonVintage,
      abv,
      description: values.description.trim() || null,
      tastingNotes: values.tastingNotes.trim() || null,
      foodPairing: values.foodPairing.trim() || null,
      servingTemperature: values.servingTemperature.trim() || null,
      internalNotes: values.internalNotes.trim() || null,
      costPerBottle: canViewCost ? cost : null,
      status: values.status,
      varietals: values.varietals
        .filter((v) => v.varietalId)
        .map((v) => ({
          varietalId: v.varietalId,
          percentage: v.percentageText.trim() ? parseWineNumber(v.percentageText) : null,
        })),
      acknowledgeDuplicate,
    };

    // Same rule function the server runs, so the messages match exactly.
    const issues = validateWineFields(payload);
    // A non-numeric vintage would arrive as null and read as "missing"; name the real problem.
    if (!values.isNonVintage && values.vintageText.trim() && payload.vintage == null) {
      issues.push({ field: 'vintage', message: WINE_MESSAGES.vintageFourDigits });
    }
    if (issues.length > 0) {
      const map: Record<string, string> = {};
      for (const issue of issues) map[issue.field] = issue.message;
      setErrors(map);
      toast.error(issues[0].message);
      return null;
    }
    setErrors({});
    return payload;
  }

  async function handleSubmit(acknowledgeDuplicate: boolean) {
    const payload = buildPayload(acknowledgeDuplicate);
    if (!payload) return;
    setSaving(true);
    try {
      const res = await submit(payload);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.duplicates) {
          setDuplicates(data.duplicates as DuplicatePayload);
          return;
        }
        if (Array.isArray(data?.fieldIssues)) {
          const map: Record<string, string> = {};
          for (const issue of data.fieldIssues) map[issue.field] = issue.message;
          setErrors(map);
        }
        toast.error(data?.error ?? 'Gagal menyimpan wine.');
        return;
      }
      setDuplicates(null);
      toast.success(successMessage);
      if (onSaved) onSaved(data);
      else router.push('/wine/list');
    } catch {
      toast.error('Gagal menyimpan wine. Silakan coba kembali.');
    } finally {
      setSaving(false);
    }
  }

  const options = masterData.data;

  return (
    <div style={{ paddingBottom: '5rem' }}>
      {/* 1 - Master Item link. The only entry point: Wine List never creates a PLU. */}
      <Section
        step={1}
        title="Master Item"
        subtitle={
          mode === 'create'
            ? 'Pilih Master Item yang sudah terdaftar. Wine List tidak membuat PLU baru.'
            : 'Master Item sumber data PLU. Tidak dapat diubah dari Wine List.'
        }
      >
        {!master && mode === 'create' && (
          <>
            <MasterItemPicker onSelect={(item) => onSelectMaster?.(item)} />
            {errors.masterItemId && (
              <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.5rem' }}>{errors.masterItemId}</p>
            )}
          </>
        )}
        {master && (
          <>
            {!master.active && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.85rem',
                  background: 'rgba(139,58,42,0.07)', border: '1px solid rgba(139,58,42,0.2)',
                  borderRadius: '0.3rem', padding: '0.5rem 0.65rem', fontSize: '0.78rem', color: '#8B3A2A',
                }}
              >
                <AlertTriangle size={13} />
                Master Item ini <strong>Inactive</strong> di registry. Data wine tetap dapat dikelola,
                namun item tidak aktif di POS.
              </div>
            )}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem',
                fontSize: '0.7rem', color: 'var(--text-secondary)',
              }}
            >
              <Lock size={11} /> Read-only dari Master Item
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '0.85rem' }}>
              <ReadOnlyField label="PLU Code" value={master.code} mono />
              <ReadOnlyField label="Existing Item Name" value={master.name} />
              <ReadOnlyField label="Barcode" value={master.barcode || '—'} mono />
              <ReadOnlyField label="Department" value={master.department} />
              <ReadOnlyField label="Category" value={master.category} />
              <ReadOnlyField label="Folder" value={master.folder || '—'} />
              <ReadOnlyField label="UOM" value={master.uom || '—'} />
              <ReadOnlyField label="Selling Price" value={formatRupiah(master.price)} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.85rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                Service Charge <BoolPill value={master.serviceCharge} />
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                Tax 1 <BoolPill value={master.tax1} />
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                Tax 2 <BoolPill value={master.tax2} />
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                No Discount <BoolPill value={master.noDiscount} />
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                Master Item Active <BoolPill value={master.active} />
              </span>
            </div>
          </>
        )}
      </Section>

      {master && (
        <>
          {/* 2 - Wine identity */}
          <Section step={2} title="Wine Identity">
            <Grid>
              <TextField
                label="Wine Name" required value={values.wineName}
                onChange={(v) => set('wineName', v)} error={errors.wineName}
                placeholder="cth. Bouchard Père & Fils Meursault 1er Cru"
                maxLength={300}
                hint="Apostrof, aksen, ampersand, garis miring dan tanda hubung didukung."
              />
              <TextField
                label="Display Name" value={values.displayName}
                onChange={(v) => set('displayName', v)} maxLength={300}
                placeholder="Nama tampilan (opsional)"
              />
              <WineSelect
                type="PRODUCER" label="Producer" required
                value={values.producerId} options={options.PRODUCER}
                onChange={(id) => set('producerId', id)}
                onCreated={(o) => masterData.addOption('PRODUCER', o)}
                error={errors.producerId}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="label-caps">
                  Vintage
                  {!values.isNonVintage && <span style={{ color: '#8B3A2A', marginLeft: '0.2rem' }}>*</span>}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    value={values.vintageText}
                    onChange={(e) => set('vintageText', e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                    disabled={values.isNonVintage}
                    placeholder="YYYY"
                    inputMode="numeric"
                    style={{
                      ...WINE_FIELD_STYLE, width: '96px',
                      borderColor: errors.vintage ? '#8B3A2A' : 'var(--input-border)',
                      opacity: values.isNonVintage ? 0.5 : 1,
                    }}
                  />
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={values.isNonVintage}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        // Non-Vintage is a flag, never a fake year - clear the field when set.
                        setValues((v) => ({ ...v, isNonVintage: checked, vintageText: checked ? '' : v.vintageText }));
                        setErrors((err) => ({ ...err, vintage: '' }));
                      }}
                    />
                    Non-Vintage (NV)
                  </label>
                </div>
                {errors.vintage && <p style={{ fontSize: '0.72rem', color: '#8B3A2A', margin: 0 }}>{errors.vintage}</p>}
              </div>
            </Grid>
          </Section>

          {/* 3 - Origin & classification */}
          <Section step={3} title="Origin & Classification">
            <Grid columns={3}>
              <WineSelect
                type="COUNTRY" label="Country" value={values.countryId} options={options.COUNTRY}
                onChange={(id) => set('countryId', id)} onCreated={(o) => masterData.addOption('COUNTRY', o)}
              />
              <WineSelect
                type="REGION" label="Region" value={values.regionId} options={options.REGION}
                onChange={(id) => set('regionId', id)} onCreated={(o) => masterData.addOption('REGION', o)}
              />
              <WineSelect
                type="APPELLATION" label="Appellation" value={values.appellationId} options={options.APPELLATION}
                onChange={(id) => set('appellationId', id)} onCreated={(o) => masterData.addOption('APPELLATION', o)}
              />
              <WineSelect
                type="CLASSIFICATION" label="Classification" value={values.classificationId} options={options.CLASSIFICATION}
                onChange={(id) => set('classificationId', id)} onCreated={(o) => masterData.addOption('CLASSIFICATION', o)}
              />
              <WineSelect
                type="WINE_TYPE" label="Wine Type" required value={values.wineTypeId} options={options.WINE_TYPE}
                onChange={(id) => set('wineTypeId', id)} onCreated={(o) => masterData.addOption('WINE_TYPE', o)}
                error={errors.wineTypeId}
              />
              <WineSelect
                type="BOTTLE_SIZE" label="Bottle Size" required value={values.bottleSizeId} options={options.BOTTLE_SIZE}
                onChange={(id) => set('bottleSizeId', id)} onCreated={(o) => masterData.addOption('BOTTLE_SIZE', o)}
                error={errors.bottleSizeId}
              />
              <WineSelect
                type="CATEGORY" label="Wine Category" value={values.categoryId} options={options.CATEGORY}
                onChange={(id) => set('categoryId', id)} onCreated={(o) => masterData.addOption('CATEGORY', o)}
              />
              <WineSelect
                type="SUB_CATEGORY" label="Sub Category 1" value={values.subCategory1Id} options={options.SUB_CATEGORY}
                onChange={(id) => set('subCategory1Id', id)} onCreated={(o) => masterData.addOption('SUB_CATEGORY', o)}
              />
              <WineSelect
                type="SUB_CATEGORY" label="Sub Category 2" value={values.subCategory2Id} options={options.SUB_CATEGORY}
                onChange={(id) => set('subCategory2Id', id)} onCreated={(o) => masterData.addOption('SUB_CATEGORY', o)}
              />
            </Grid>
          </Section>

          {/* 4 - Product info: varietals (a blend has several) + ABV */}
          <Section step={4} title="Product Information" subtitle="Satu wine dapat memiliki lebih dari satu varietal.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem' }}>
              {values.varietals.map((row, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem' }}>
                  <div style={{ flex: 1 }}>
                    <WineSelect
                      type="VARIETAL" label={`Varietal ${index + 1}`}
                      value={row.varietalId || null} options={options.VARIETAL}
                      onChange={(id) => setValues((v) => ({
                        ...v,
                        varietals: v.varietals.map((r, i) => (i === index ? { ...r, varietalId: id ?? '' } : r)),
                      }))}
                      onCreated={(o) => masterData.addOption('VARIETAL', o)}
                    />
                  </div>
                  <div style={{ width: '110px' }}>
                    <TextField
                      label="%" value={row.percentageText}
                      onChange={(val) => setValues((v) => ({
                        ...v,
                        varietals: v.varietals.map((r, i) => (i === index ? { ...r, percentageText: val } : r)),
                      }))}
                      placeholder="opsional"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setValues((v) => ({ ...v, varietals: v.varietals.filter((_, i) => i !== index) }))}
                    className="btn-secondary"
                    style={{ padding: '0.4rem 0.5rem', height: '34px' }}
                    aria-label="Hapus varietal"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setValues((v) => ({ ...v, varietals: [...v.varietals, { varietalId: '', percentageText: '' }] }))}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
            >
              <Plus size={12} /> Tambah Varietal
            </button>
            <div style={{ marginTop: '0.95rem', maxWidth: '220px' }}>
              <TextField
                label="ABV (%)" value={values.abvText} onChange={(v) => set('abvText', v)}
                error={errors.abv} placeholder="cth. 13.5"
              />
            </div>
          </Section>

          {/* 5 - Commercial: price is read-only from the master, cost is permissioned */}
          <Section step={5} title="Commercial Information">
            <Grid columns={3}>
              <ReadOnlyField label="Selling Price (Master Item)" value={formatRupiah(master.price)} />
              <div>
                {canViewCost ? (
                  <TextField
                    label="Cost per Bottle" value={values.costText}
                    onChange={(v) => set('costText', v)} error={errors.costPerBottle}
                    placeholder="cth. 450000"
                  />
                ) : (
                  <>
                    <div className="label-caps" style={{ fontSize: '0.58rem', marginBottom: '0.2rem' }}>Cost per Bottle</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <Lock size={11} /> {WINE_MESSAGES.costForbidden}
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="label-caps">Status</label>
                <select
                  value={values.status}
                  onChange={(e) => set('status', e.target.value as 'Active' | 'Inactive')}
                  style={{ ...WINE_FIELD_STYLE, cursor: 'pointer' }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </Grid>
            {priceLevels.entries.length > 0 && (
              <div style={{ marginTop: '0.95rem' }}>
                <div className="label-caps" style={{ marginBottom: '0.35rem' }}>
                  Price Levels (Master Item)
                </div>
                <p style={{ fontSize: '0.72rem', color: '#8B6914', margin: '0 0 0.4rem' }}>
                  Item ini memiliki price level aktif - harga per outlet dapat berbeda dari harga flat.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {priceLevels.entries.map((entry, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.7rem', padding: '2px 7px', borderRadius: '3px',
                        background: 'var(--bg-cream)', border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {entry.outletType || '—'} · {entry.outletGroup || '—'} ·{' '}
                      {entry.price.toLocaleString('id-ID')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* 6 - Outlet availability: which outlets carry the item, read from the master */}
          <Section
            step={6}
            title="Outlet Information"
            subtitle="Availability = wine aktif/dipakai di outlet tersebut, bukan jumlah stok fisik."
          >
            {outletList.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#8B3A2A', margin: 0 }}>
                Master Item ini belum memiliki outlet aktif.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {outletList.map((outlet) => (
                  <span
                    key={outlet}
                    style={{
                      fontSize: '0.72rem', padding: '2px 8px', borderRadius: '3px',
                      background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
                      color: '#8B6914', fontWeight: 500,
                    }}
                  >
                    {outlet}
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* 7 - Additional info */}
          <Section step={7} title="Additional Information">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="label-caps">Description</label>
                <textarea value={values.description} onChange={(e) => set('description', e.target.value)} style={WINE_TEXTAREA_STYLE} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="label-caps">Tasting Notes</label>
                <textarea value={values.tastingNotes} onChange={(e) => set('tastingNotes', e.target.value)} style={WINE_TEXTAREA_STYLE} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="label-caps">Food Pairing</label>
                <textarea value={values.foodPairing} onChange={(e) => set('foodPairing', e.target.value)} style={WINE_TEXTAREA_STYLE} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <TextField
                  label="Serving Temperature" value={values.servingTemperature}
                  onChange={(v) => set('servingTemperature', v)} placeholder="cth. 14-16°C"
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label className="label-caps">Internal Notes</label>
                  <textarea value={values.internalNotes} onChange={(e) => set('internalNotes', e.target.value)} style={WINE_TEXTAREA_STYLE} />
                </div>
              </div>
            </div>
          </Section>

          {/* 8 - Review */}
          <Section step={8} title="Review & Save">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '0.85rem' }}>
              <ReadOnlyField label="Wine Name" value={values.wineName || '—'} />
              <ReadOnlyField
                label="Vintage"
                value={values.isNonVintage ? 'NV' : values.vintageText || '—'}
              />
              <ReadOnlyField
                label="Producer"
                value={options.PRODUCER.find((o) => o.id === values.producerId)?.name ?? '—'}
              />
              <ReadOnlyField
                label="Bottle Size"
                value={options.BOTTLE_SIZE.find((o) => o.id === values.bottleSizeId)?.name ?? '—'}
              />
              <ReadOnlyField label="PLU Code" value={master.code} mono />
              <ReadOnlyField label="Barcode" value={master.barcode || '—'} mono />
              <ReadOnlyField label="Selling Price" value={formatRupiah(master.price)} />
              <ReadOnlyField label="Status" value={values.status} />
            </div>
            {masterData.failed && (
              <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.75rem' }}>
                Master data wine gagal dimuat - beberapa pilihan mungkin kosong.{' '}
                <button
                  type="button"
                  onClick={masterData.reload}
                  style={{ background: 'none', border: 'none', color: '#8B6914', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
                >
                  Coba lagi
                </button>
              </p>
            )}
          </Section>
        </>
      )}

      {/* Sticky footer */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 25,
          background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
          padding: '0.75rem 2.5rem', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '1rem',
        }}
        className="wine-sticky-footer"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <Database size={12} />
          <Link href="/wine/master-data" style={{ color: '#8B6914', textDecoration: 'none' }}>
            Kelola master data wine
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href={cancelHref} className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving || !master}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitLabel}
          </button>
        </div>
      </div>

      {duplicates && (
        <DuplicateWarning
          duplicates={duplicates}
          busy={saving}
          onCancel={() => setDuplicates(null)}
          onContinue={() => handleSubmit(true)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 767px) { .wine-sticky-footer { padding: 0.75rem 1rem; } }
      `}</style>
    </div>
  );
}
