# PLU Management Portal - Project Context

Internal web portal for **The Union Group (Jakarta)** hospitality operations. It is the controlled workflow layer that sits between the outlets (restaurants/bars/cafés) and the **Quinos POS** system: cashiers request menu/price changes, the head office reviews and finalizes them, and the portal produces **Quinos-compatible import files** so the POS menu stays consistent across every outlet.

> **PLU = Price Look-Up** - the unique code/record for every sellable item in the POS (food, drinks, wine, cigars, merchandise, modifiers).

---

## 1. What the business is

The Union Group runs a portfolio of F&B venues in Jakarta, organized into **outlet groups** (brands/regions). Each physical venue is an **outlet** with its own POS terminals, printers, and menu. Because the same item (e.g. a wine, a cocktail, a dish) can exist across many outlets - often with per-outlet pricing - item data must be governed centrally to avoid drift, duplicates, and pricing errors.

### Outlet groups & outlets

| Group      | Meaning                 | Example outlets                                                                   |
| ---------- | ----------------------- | --------------------------------------------------------------------------------- |
| **UNION**  | Union Group core venues | UTP, UPKW, UPS, USC, UCP, UGI, UPIM, UPIK, UMKG, USMS, UMPI (+ `-B` bar variants) |
| **CNS**    | Cork & wine-bar venues  | CSPI, CSPP, CSSG (+ `-B`), BLCS                                                   |
| **FRENCH** | French-concept venues   | LWY-OAK, BAB-SEN, PIE-SNPT (+ `-B`)                                               |
| **IBR**    | IBR-group venues        | ROMSCBD, ROMPIM, BISSCBD, BISPIK, MILGI, MILPIK                                   |
| **IND**    | Independent             | IND1                                                                              |

- **`-B` suffix** = the bar side of a venue (separate outlet in the POS).
- **Cork outlets** (`CSPP, CSPI, CSSG` + `-B`) are the wine-focused outlets whose **WINE new-item** requests get an extra Cost Control review (see §5).
- **MILGI / MILPIK** are collapsed to a combined **`MILBISPIK`** label on the admin/export side only.

---

## 2. What the company runs on (systems this portal integrates with)

| System                   | Role                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Quinos POS**           | The point-of-sale that actually rings up sales. This portal's output is imported into Quinos. Everything (code layout, price levels, printer routing, tax/service flags) is shaped to Quinos' import format. |
| **SAP**                  | Source-of-truth item master for **WINE** (item numbers, descriptions). Wine "barcodes" in Quinos are actually SAP item numbers. Imported into the portal as the **SAP Master Item** registry.                |
| **NCK codes**            | SAP wine codes flagged `(NCK)` from which a scan barcode is **derived**: `digits-only + "11"` - e.g. `3151476(NCK)` → `315147611`. This is how wine bottles get a scannable barcode.                         |
| **XEVLA**                | A secondary 6-digit code system bridged to SAP during physical-stock reconciliation (`XEVLA_6 → bridge → SAP → NCK`).                                                                                        |
| **Master Item Registry** | The portal's own snapshot of the live Quinos menu (imported via CSV/XLSX), used for lookups, price checks, reconciliation, and data-quality analysis.                                                        |

---

## 3. The PLU code system (core domain rule)

Every item has a **16-character code**:

```
┌─────┬────┬─────┬────────────┐
│ PRE │ DD │ CCC │  SEQUENCE  │
│ (3) │(2) │ (3) │    (8)     │
└─────┴────┴─────┴────────────┘
  TUG   20   701   00004000
```

- **Prefix (3)** - derived from the **selected outlets**, not the cashier's login outlet:
  - TUG-exempt departments (**ALCOHOLIC BEVERAGES, NON ALCOHOLIC BEVERAGES, WINE, CIGAR-ETTES, MISCELLANEOUS**) always use the shared **`TUG`** prefix (these items are treated as group-wide).
  - Other departments (FOOD, COCKTAILS, BAKERY, PASTRY) use the outlet's own prefix (`UNI`, `CNS`, `LWY`, `ROM`, `BIS`, `MIL`, …). Mixed-outlet selections can split into multiple prefix groups.
  - Known prefixes: `ROM, BCH, LWY, PIE, TUG, UNI, CNS, MIL, BIS, BLC, SLR`.
- **Department code (2)** + **Category code (3)** - from the fixed category map (`lib/pluCode.ts` / `CategoryConfig`). e.g. FOOD=10, ALCOHOLIC BEVERAGES=20, COCKTAILS=30, NON-ALC=40, WINE=50, PASTRY=60, BAKERY=70, CIGAR-ETTES=80, MISCELLANEOUS=90. Categories prefixed **`MIL`** are a parallel menu line reusing the same department codes with higher category numbers.
- **Sequence (8)** - zero-padded running number (new items start at 4000).

Each item also carries: **price**, optional **price levels** (per outlet-type/outlet-group pricing), **barcode**, **printers** (kitchen/bar routing), **outlets**, **UOM**, **folder**, and POS flags (**serviceCharge, tax1, tax2, noDiscount, hideReceipt**).

### Price Levels

Raw Quinos format: `DINE IN:CSPI+CSPI-B:1100000;TAKE AWAY:CSPI:1100000;…`
(entries `;`, fields `:`, outlets `+`). A flat price can be overridden by an active price level - the portal warns about this during price imports.

---

## 4. Roles

| Role             | Can do                                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CASHIER**      | Submit requests for their outlet(s): new item, price update, name/printer/full update, item removal, discount button requests. Batch (multi-item) submissions and file import supported. Cannot see other outlets' data or finalize. |
| **COST_CONTROL** | Review/confirm the barcode + pricing stage for **WINE new-item** requests from Cork outlets before they reach admin. Also has read access to Data Quality.                                                                           |
| **ADMIN**        | Head-office menu governance: review all requests, approve/reject, bulk-action, mark **DONE**, export to Quinos format, manage the Knowledge Base, users, and config (outlets/printers/categories).                                   |

Auth: **NextAuth v4 (credentials, JWT sessions)**; role/outlet stamped into the token. Route handlers re-check role server-side.

---

## 5. Core business processes (workflows)

### A. New Item request (the main flow)

```
Cashier fills item form
  → portal suggests a PLU code (prefix from selected outlets + dept/cat + sequence)
  → [WINE + Cork outlet only] Cost Control stage:
        system suggests SAP NCK barcode → Cost Control confirms/corrects
  → Admin reviews (PENDING) → marks DONE
  → Admin exports approved items → Quinos import file (CSV/XLSX)
  → Item goes live in Quinos POS
```

- Status lifecycle is intentionally simple: **PENDING → DONE** (rejections carry an `adminNote`).
- Export stamps `exportCount / lastExportedAt / exportBatchId` to prevent duplicate imports.

### B. Price Update

- Single or batch. Cashier finds the existing item via **barcode search** or PLU search (dual-source: Master Item + SAP registry, with NCK fallback; scanner "Enter" auto-submits).
- **Batch file import** auto-resolves PLU codes from cashier files (which carry only Name/Category/Department/Barcode/Price, no code) via a matching cascade: **barcode → name+category → fuzzy name → reject** (`lib/itemMatch.ts`, `/api/plu/match-batch`).
- Warns when a matched item has active **price levels** that would override a flat price change, and (for wine) runs a **barcode-integrity check** against SAP.

### C. Name / Printer / Full Update

- Change display name, printer routing, or a full record edit for an existing item; same PENDING → DONE → export path.

### D. Remove PLU

- `REMOVE_PLU` request type to deactivate an item; cashier looks it up via `PLUCodeSearch`; admin removal page + export template.

### E. Discount button requests

- Cashiers request POS discount buttons (type, value, applicability, conditions); admin finalizes. Separate `DiscountRequest` model.

### F. Batch requests

- Multiple items grouped under one `RequestBatch` (title + type), reviewed/finalized/exported together.

### G. Export → Quinos

- All admin exports emit **one 19-column structure** (leading `Active`, trailing `PriceLevels`). NEW*ITEM columns come from the request; UPDATE*\*/REMOVE_PLU derive from the master overriding a single column. Produces CSV/XLSX ready for Quinos import.

---

## 6. Feature areas (surfaces)

### Cashier

- Dashboard, submit request (new/price/name/printer/full), batch new + edit, item lookup, discount requests.

### Cost Control

- Dashboard + queue: confirm/reject WINE new-item barcode & pricing for Cork outlets; history.

### Admin

- Requests review (approve/reject/bulk/done), batches, export (CSV/XLSX, per-batch), price-check, removal, discount admin, users, **config** (outlets, printers, categories), notifications, metrics.

### Knowledge Base (`/admin/kb`) - reference & data-governance tooling

| Tool                       | Purpose                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Master Items**           | Browse/search the imported Quinos menu snapshot; upload CSV/XLSX; per-item detail; **Master All Item** XLSX report (all-item + per-outlet sheets).                                                                                                                                                                                           |
| **SAP Master Items**       | Import & browse the SAP wine registry (item no / description / subgroup / barcode).                                                                                                                                                                                                                                                          |
| **Data Quality**           | Dashboards for **duplicate analysis + SAP evidence**, price gaps, duplicate barcodes, and trial/placeholder items. Duplicate engine groups look-alike masters and classifies each group (**Likely Duplicate / SAP-Separated / Ambiguous / No SAP Evidence**) with lazy, paginated per-group SAP evidence. Read-only - never mutates masters. |
| **Wiki / Glossary**        | Internal documentation and term/abbreviation reference (seeded defaults + editable).                                                                                                                                                                                                                                                         |

---

## 7. Technical architecture

| Layer            | Choice                                                                                                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**    | Next.js 14 (App Router, TypeScript, React 18)                                                                                                                                                                                                                                                                  |
| **Auth**         | NextAuth v4 - credentials provider, JWT strategy                                                                                                                                                                                                                                                               |
| **Data access**  | **sql.js** (SQLite compiled to WebAssembly) read/written directly in `lib/db.ts`. Prisma schema defines the shape and is used for `db push`/seeding, but **runtime queries bypass Prisma's native engine** - its `.so.node` binary gets killed under cPanel resource limits, so the app runs pure-WASM SQLite. |
| **DB file**      | SQLite (`prisma/dev.db` in dev). Tables also self-migrate via `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` in `getDb()`.                                                                                                                                                                            |
| **UI**           | Tailwind CSS (Union Group brand theme), Radix UI primitives, lucide-react icons, sonner toasts.                                                                                                                                                                                                                |
| **Spreadsheets** | `xlsx` (SheetJS) for all import/export and reports.                                                                                                                                                                                                                                                            |
| **Hosting**      | cPanel/shared-hosting constraints drive several design choices (no native Prisma engine; SQLite over WASM; synchronous DB on the event loop → heavy analysis passes are cached + paginated).                                                                                                                   |

### Pure, testable domain libs (`lib/`)

- `pluCode.ts` - code assembly, prefix derivation, category map.
- `itemMatch.ts` - import-row → master matching cascade (barcode/name+cat/fuzzy).
- `barcode.ts` - NCK barcode derivation.
- `dupAnalysis.ts` + `dupCache.ts` - duplicate grouping & SAP evidence (cached, lazy).
- `export.ts`, `masterReport.ts`, `priceLevels.ts`, `outlets.ts`, `categories.ts`, `configLoader.ts`.

---

## 8. Data model (key tables)

| Table                                                | Purpose                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **User**                                             | Login, role (CASHIER/COST_CONTROL/ADMIN), outlet.                                                                  |
| **PLURequest**                                       | A single change request (type, item fields, status PENDING/DONE, cost-control barcode fields, export/done stamps). |
| **RequestBatch / RequestBatchItem**                  | Multi-item request grouped for review/export.                                                                      |
| **DiscountRequest**                                  | POS discount-button requests.                                                                                      |
| **MasterItem**                                       | Snapshot of the live Quinos menu (imported); includes `priceLevels`, `outlets`, `active`.                          |
| **SapMasterItem**                                    | SAP wine registry (item no / description / subgroup / barcode).                                                    |
| **OutletConfig / PrinterConfig / CategoryConfig**    | Editable reference data driving forms, code generation, and printer routing.                                       |
| **WikiArticle / GlossaryEntry**                      | Knowledge Base content.                                                                                            |

**Request types:** `NEW_ITEM`, `UPDATE_PRICE`, `UPDATE_NAME`, `UPDATE_PRINTER`, `UPDATE_FULL` (legacy), `REMOVE_PLU`.

---

## 9. Guiding constraints & conventions

- **The POS is the boss:** codes, columns, price-level strings, and printer names all mirror Quinos exactly.
- **No accidental double-imports:** export state is tracked; requests move PENDING → DONE.
- **Central governance:** prefixes/departments enforce group-wide vs outlet-specific item scoping; Data Quality guards against duplicates and drift.
- **Wine is special:** SAP is its source of truth, barcodes are SAP-derived (NCK), and Cork-outlet wine additions get a Cost Control gate.
- **Runs lean on shared hosting:** WASM SQLite, synchronous DB, so expensive analysis is cached, paginated, and lazy-loaded.
- **Language:** UI is bilingual-leaning - Indonesian labels/reasons with English domain terms.

---

_This document describes the portal's business context and how it fits the company's operations. For code-level detail see `lib/` (pure domain logic), `app/api/` (route handlers), and `prisma/schema.prisma` (data shape)._
