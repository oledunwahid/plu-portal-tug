'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { WINE_MESSAGES } from '@/lib/wine';
import { WineForm, type WineFormMasterInfo, type WineFormValues, type WineFormSubmitPayload } from '@/components/wine/WineForm';

interface LoadedWine {
  id: string;
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
  updatedAt: string;
  masterItemCode: string | null;
  masterItemName: string | null;
  master: (WineFormMasterInfo & { id: string }) | null;
}

export default function EditWinePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [initial, setInitial] = useState<WineFormValues | null>(null);
  const [master, setMaster] = useState<WineFormMasterInfo | null>(null);
  const [wineName, setWineName] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [canViewCost, setCanViewCost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wines/${params.id}`);
      if (res.status === 404) { setError('Wine tidak ditemukan.'); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      const wine = data.wine as LoadedWine;
      const varietals = (data.varietals ?? []) as { varietalId: string; percentage: number | null }[];
      setWineName(wine.wineName);
      // The updatedAt we loaded doubles as the optimistic-lock token on save.
      setUpdatedAt(wine.updatedAt);
      setCanViewCost(Boolean(data.canViewCost));
      setMaster(wine.master);
      setInitial({
        wineName: wine.wineName,
        displayName: wine.displayName ?? '',
        producerId: wine.producerId,
        countryId: wine.countryId,
        regionId: wine.regionId,
        appellationId: wine.appellationId,
        classificationId: wine.classificationId,
        wineTypeId: wine.wineTypeId,
        categoryId: wine.categoryId,
        subCategory1Id: wine.subCategory1Id,
        subCategory2Id: wine.subCategory2Id,
        bottleSizeId: wine.bottleSizeId,
        vintageText: wine.vintage != null ? String(wine.vintage) : '',
        isNonVintage: wine.isNonVintage,
        abvText: wine.abv != null ? String(wine.abv) : '',
        description: wine.description ?? '',
        tastingNotes: wine.tastingNotes ?? '',
        foodPairing: wine.foodPairing ?? '',
        servingTemperature: wine.servingTemperature ?? '',
        internalNotes: wine.internalNotes ?? '',
        costText: wine.costPerBottle != null ? String(wine.costPerBottle) : '',
        status: wine.status,
        varietals: varietals.map((v) => ({
          varietalId: v.varietalId,
          percentageText: v.percentage != null ? String(v.percentage) : '',
        })),
      });
      setError(null);
    } catch {
      setError(WINE_MESSAGES.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  async function submit(payload: WineFormSubmitPayload): Promise<Response> {
    // masterItemId is intentionally not sent: the Master Item link is fixed after creation.
    const { masterItemId: _ignored, ...rest } = payload;
    return fetch(`/api/wines/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rest, expectedUpdatedAt: updatedAt }),
    });
  }

  if (loading) {
    return (
      <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  if (error || !initial) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9rem', color: '#8B3A2A', marginBottom: '1rem' }}>{error ?? WINE_MESSAGES.loadFailed}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button type="button" onClick={load} className="btn-secondary">Coba kembali</button>
          <Link href="/wine/list" className="btn-secondary" style={{ textDecoration: 'none' }}>Wine List</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/wine/list/${params.id}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '0.75rem' }}
      >
        <ChevronLeft size={13} /> {wineName}
      </Link>
      <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Edit Wine</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Harga jual, PLU code, barcode, folder dan outlet mengikuti Master Item dan tidak dapat diubah
        dari halaman ini.
      </p>

      <WineForm
        mode="edit"
        master={master}
        initialValues={initial}
        canViewCost={canViewCost}
        submit={submit}
        onSaved={() => router.push(`/wine/list/${params.id}`)}
        cancelHref={`/wine/list/${params.id}`}
        submitLabel="Save Changes"
        successMessage="Perubahan wine berhasil disimpan."
      />
    </div>
  );
}
