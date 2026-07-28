'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronLeft } from 'lucide-react';
import { canViewWineCost } from '@/lib/winePermissions';
import { WineForm, emptyWineFormValues, type WineFormMasterInfo, type WineFormSubmitPayload } from '@/components/wine/WineForm';
import type { MasterItemCandidate } from '@/components/wine/MasterItemPicker';

/**
 * Add Wine. Deliberately has no "manual wine record" option: a Wine Master always points at an
 * existing Master Item, so wine data can never drift away from the POS registry. New products go
 * through New Item Request → DONE → Pending Publication instead.
 */
export default function NewWinePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [master, setMaster] = useState<WineFormMasterInfo | null>(null);
  // Cost field visibility only; the server independently refuses to store a cost from a caller
  // without WINE_LIST_VIEW_COST.
  const canViewCost = canViewWineCost(session?.user as never);

  function handleSelect(item: MasterItemCandidate) {
    setMaster({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      department: item.department,
      price: item.price,
      barcode: item.barcode,
      folder: item.folder,
      uom: item.uom,
      outlets: item.outlets,
      priceLevels: item.priceLevels ?? null,
      active: item.active,
      serviceCharge: item.serviceCharge ?? true,
      tax1: item.tax1 ?? true,
      tax2: item.tax2 ?? true,
      noDiscount: item.noDiscount ?? true,
    });
  }

  async function submit(payload: WineFormSubmitPayload): Promise<Response> {
    return fetch('/api/wines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  return (
    <div>
      <Link
        href="/wine/list"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '0.75rem' }}
      >
        <ChevronLeft size={13} /> Wine List
      </Link>
      <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Add Wine</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Tambah wine dari Master Item yang sudah terdaftar. Wine List tidak membuat PLU baru.
      </p>

      <WineForm
        mode="create"
        master={master}
        initialValues={emptyWineFormValues()}
        canViewCost={canViewCost}
        onSelectMaster={handleSelect}
        submit={submit}
        onSaved={(data) => {
          const wineId = (data as { wine?: { id?: string } })?.wine?.id;
          router.push(wineId ? `/wine/list/${wineId}` : '/wine/list');
        }}
        cancelHref="/wine/list"
        submitLabel="Save Wine"
        successMessage="Wine berhasil disimpan."
      />
    </div>
  );
}
