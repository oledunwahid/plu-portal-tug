/**
 * Wine List CSV export.
 *
 * Excel-compatible CSV rather than XLSX: the wine team's own file is a flat list, CSV round-trips
 * straight back through the importer, and it keeps the response cheap for a 7k-row catalog.
 *
 * Cost per Bottle is included ONLY when the caller holds WINE_LIST_VIEW_COST - the column is dropped
 * entirely, not blanked, so a shared file can't imply the value exists but was hidden.
 */

import { formatVintage } from './wine';
import type { WineMasterView } from './wineDb';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvField(cell ?? '')).join(',')),
  ];
  // Excel needs a BOM to read UTF-8 accents (Père, Rhône) correctly.
  return `﻿${lines.join('\r\n')}`;
}

const BASE_HEADERS = [
  'Status',
  'Wine Name',
  'Display Name',
  'Producer',
  'Vintage',
  'Country',
  'Region',
  'Appellation',
  'Classification',
  'Wine Type',
  'Category',
  'Sub Category 1',
  'Sub Category 2',
  'Bottle Size',
  'Varietal',
  'ABV',
  'PLU Code',
  'Barcode',
  'Department',
  'Master Category',
  'Folder',
  'UOM',
  'Selling Price',
  'Price Levels',
  'Outlets',
  'Master Item Active',
  'Legacy Wine Code',
  'Source Request',
  'Last Updated',
];

export function generateWineListCsv(wines: WineMasterView[], includeCost: boolean): string {
  const headers = includeCost
    // Cost sits next to the selling price so the two read together.
    ? [...BASE_HEADERS.slice(0, 23), 'Cost per Bottle', ...BASE_HEADERS.slice(23)]
    : BASE_HEADERS;

  const rows = wines.map((wine) => {
    const base = [
      wine.status,
      wine.wineName,
      wine.displayName ?? '',
      wine.producerName ?? '',
      formatVintage(wine.vintage, wine.isNonVintage),
      wine.countryName ?? '',
      wine.regionName ?? '',
      wine.appellationName ?? '',
      wine.classificationName ?? '',
      wine.wineTypeName ?? '',
      wine.categoryName ?? '',
      wine.subCategory1Name ?? '',
      wine.subCategory2Name ?? '',
      wine.bottleSizeName ?? '',
      wine.varietalNames ?? '',
      wine.abv != null ? String(wine.abv) : '',
      wine.master?.code ?? wine.masterItemCode ?? '',
      wine.master?.barcode ?? '',
      wine.master?.department ?? '',
      wine.master?.category ?? '',
      wine.master?.folder ?? '',
      wine.master?.uom ?? '',
      wine.master?.price != null ? String(wine.master.price) : '',
    ];
    const tail = [
      wine.master?.priceLevels ?? '',
      wine.master?.outlets ?? '',
      wine.master ? (wine.master.active ? '1' : '0') : '',
      wine.legacyWineCode ?? '',
      wine.sourceRequestId ?? '',
      wine.updatedAt,
    ];
    return includeCost
      ? [...base, wine.costPerBottle != null ? String(wine.costPerBottle) : '', ...tail]
      : [...base, ...tail];
  });

  return toCsv(headers, rows);
}
