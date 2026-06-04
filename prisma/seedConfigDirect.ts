/**
 * Direct sql.js seed for OutletConfig, PrinterConfig, CategoryConfig.
 *
 * Uses lib/db.ts (sql.js) for all writes — no Prisma, no WAL gap.
 * After this script exits the binary .db file contains the seeded data.
 * Restart the Next.js dev server once to pick up the changes.
 *
 * Usage:
 *   npm run seed:config:direct
 *
 * DATABASE_URL is read from .env.local (then .env) if not already in the environment.
 */

import fs from 'fs';
import path from 'path';

// Load DATABASE_URL from .env.local / .env before any db call.
// lib/db.ts reads process.env.DATABASE_URL inside getDb() (not at import time),
// so setting it here — before main() runs — is sufficient.
function loadEnv(): void {
  for (const name of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*)/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
    return;
  }
}

import { seedOutletConfigs, seedPrinterConfigs, seedCategoryConfigs } from '../lib/db';

// ── Data ──────────────────────────────────────────────────────────────────────

const OUTLETS: { code: string; group: string }[] = [
  // UNION
  ...['UTP','UPKW','UPS','USC','UCP','UGI','UPIM','UPIK','UMKG','USMS','UMPI','UCP-B','UPS-B','USC-B','UPIK-B','UMKG-B','UMPI-B']
    .map((code) => ({ code, group: 'UNION' })),
  // CNS
  ...['CSPI','CSPP','CSSG','CSPI-B','CSPP-B','CSSG-B','BLCS']
    .map((code) => ({ code, group: 'CNS' })),
  // FRENCH
  ...['LWY-OAK','LWY-OAK-B','BAB-SEN','BAB-SEN-B','PIE-SNPT','PIE-SNPT-B']
    .map((code) => ({ code, group: 'FRENCH' })),
  // IBR
  ...['ROMSCBD','ROMPIM','BISSCBD','BISPIK','MILGI','MILPIK','BISSCBD-B']
    .map((code) => ({ code, group: 'IBR' })),
  // IND
  { code: 'IND1', group: 'IND' },
];

const PRINTERS: { name: string; group: string }[] = [
  ...['KITCHEN1','KITCHEN2','KITCHEN3','KITCHEN4','KITCHEN5','KITCHEN6','CK KITCHEN','CK KITCHEN 2','PIZZA','PASTRY']
    .map((name) => ({ name, group: 'ALL' })),
  ...['BAR','BAR2','BAR3','BAR4','BAR5','BAR6','CK BAR','WINE','WINE2']
    .map((name) => ({ name, group: 'ALL' })),
  ...['BL','BILL','DESSERT','DESSERT2','DESSERT3']
    .map((name) => ({ name, group: 'ALL' })),
  ...['CIGAR','CIGAR2']
    .map((name) => ({ name, group: 'ALL' })),
  ...['EVENT','EVENT2','EVENT3']
    .map((name) => ({ name, group: 'ALL' })),
];

const CATEGORIES: { name: string; department: string; departmentCode: number; categoryCode: number }[] = [
  // FOOD
  { department: 'FOOD', departmentCode: 10, name: 'Asian', categoryCode: 101 },
  { department: 'FOOD', departmentCode: 10, name: 'Grilled', categoryCode: 102 },
  { department: 'FOOD', departmentCode: 10, name: 'Mains', categoryCode: 103 },
  { department: 'FOOD', departmentCode: 10, name: 'Pasta', categoryCode: 104 },
  { department: 'FOOD', departmentCode: 10, name: 'Sandwich', categoryCode: 106 },
  { department: 'FOOD', departmentCode: 10, name: 'Snack', categoryCode: 107 },
  { department: 'FOOD', departmentCode: 10, name: 'Starter', categoryCode: 108 },
  { department: 'FOOD', departmentCode: 10, name: 'Side Dishes', categoryCode: 109 },
  { department: 'FOOD', departmentCode: 10, name: 'Salad', categoryCode: 110 },
  { department: 'FOOD', departmentCode: 10, name: 'Dessert Food', categoryCode: 111 },
  { department: 'FOOD', departmentCode: 10, name: 'Special', categoryCode: 112 },
  { department: 'FOOD', departmentCode: 10, name: 'Food Event', categoryCode: 113 },
  { department: 'FOOD', departmentCode: 10, name: 'Food Promo', categoryCode: 114 },
  { department: 'FOOD', departmentCode: 10, name: 'Additional Food', categoryCode: 116 },
  { department: 'FOOD', departmentCode: 10, name: 'Special Feast', categoryCode: 117 },
  { department: 'FOOD', departmentCode: 10, name: 'Breakfast', categoryCode: 118 },
  { department: 'FOOD', departmentCode: 10, name: 'Pizza', categoryCode: 119 },
  { department: 'FOOD', departmentCode: 10, name: 'Modifier Food', categoryCode: 120 },
  { department: 'FOOD', departmentCode: 10, name: 'U+Reward Food', categoryCode: 121 },
  { department: 'FOOD', departmentCode: 10, name: 'Tapas', categoryCode: 122 },
  { department: 'FOOD', departmentCode: 10, name: 'Brunch', categoryCode: 123 },
  { department: 'FOOD', departmentCode: 10, name: 'Complimentary Food', categoryCode: 124 },
  { department: 'FOOD', departmentCode: 10, name: 'Set Menu', categoryCode: 125 },
  // MIL FOOD
  { department: 'FOOD', departmentCode: 10, name: 'MIL Asian', categoryCode: 126 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Grilled', categoryCode: 127 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Mains', categoryCode: 128 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Pasta', categoryCode: 129 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Sandwich', categoryCode: 130 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Snack', categoryCode: 131 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Starter', categoryCode: 132 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Side Dishes', categoryCode: 133 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Salad', categoryCode: 134 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Dessert Food', categoryCode: 135 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Lunch Specials', categoryCode: 136 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Special', categoryCode: 137 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Food Event', categoryCode: 138 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Food Promo', categoryCode: 139 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Additional Food', categoryCode: 140 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Special Feast', categoryCode: 141 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Breakfast', categoryCode: 142 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Pizza', categoryCode: 143 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Modifier Food', categoryCode: 144 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL U+Reward Food', categoryCode: 145 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Tapas', categoryCode: 146 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Brunch', categoryCode: 147 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Complimentary Food', categoryCode: 148 },
  { department: 'FOOD', departmentCode: 10, name: 'MIL Set Menu', categoryCode: 149 },
  // ALCOHOLIC BEVERAGES
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Aperitif and Liqueur', categoryCode: 201 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Beer', categoryCode: 202 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Brandy and Cognac', categoryCode: 203 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Gin', categoryCode: 204 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Rum', categoryCode: 205 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Tequila and Mezcal', categoryCode: 207 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Vodka', categoryCode: 208 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Whisk(e)y', categoryCode: 209 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Beverages Promo', categoryCode: 211 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'Modifier Spirit', categoryCode: 213 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'U+Reward Beverages', categoryCode: 214 },
  // MIL ALCOHOLIC
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Aperitif and Liqueur', categoryCode: 215 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Beer', categoryCode: 216 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Brandy and Cognac', categoryCode: 217 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Gin', categoryCode: 218 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Rum', categoryCode: 219 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Tequila and Mezcal', categoryCode: 220 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Vodka', categoryCode: 221 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Whisk(e)y', categoryCode: 222 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Beverages Promo', categoryCode: 223 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL Modifier Spirit', categoryCode: 224 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, name: 'MIL U+Reward Beverages', categoryCode: 225 },
  // COCKTAILS
  { department: 'COCKTAILS', departmentCode: 30, name: 'Cocktails Classic', categoryCode: 301 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'Cocktails Signature', categoryCode: 302 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'Cocktails Event', categoryCode: 303 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'Cocktails Promo', categoryCode: 304 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'Modifier Cocktail', categoryCode: 305 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'U+Reward Cocktails', categoryCode: 306 },
  // MIL COCKTAILS
  { department: 'COCKTAILS', departmentCode: 30, name: 'MIL Cocktails Classic', categoryCode: 307 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'MIL Cocktails Signature', categoryCode: 308 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'MIL Cocktails Event', categoryCode: 309 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'MIL Cocktails Promo', categoryCode: 310 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'MIL Modifier Cocktail', categoryCode: 311 },
  { department: 'COCKTAILS', departmentCode: 30, name: 'MIL U+Reward Cocktails', categoryCode: 312 },
  // NON ALCOHOLIC BEVERAGES
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Coffee', categoryCode: 401 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Mocktails and Smoothies', categoryCode: 402 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Mineral Water', categoryCode: 403 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Soft Drink', categoryCode: 404 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Juices', categoryCode: 405 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Tea', categoryCode: 406 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Mixer', categoryCode: 407 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Beverages Modifier', categoryCode: 408 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Beverages Promo Non Alcohol', categoryCode: 409 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'Additional Bev Non Alcohol', categoryCode: 410 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'U+Reward Beverages Non Alcohol', categoryCode: 411 },
  // MIL NON ALCOHOLIC
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Additional Bev Non Alcohol', categoryCode: 413 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Coffee', categoryCode: 414 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Mocktails and Smoothies', categoryCode: 415 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Tea', categoryCode: 416 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Mineral Water', categoryCode: 417 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Soft Drink', categoryCode: 418 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Juices', categoryCode: 419 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Mixer', categoryCode: 420 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Beverages Modifier', categoryCode: 421 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Beverages Promo Non Alcohol', categoryCode: 422 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL U+Reward Beverages Non Alcohol', categoryCode: 423 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, name: 'MIL Beverages Event Non Alcohol', categoryCode: 424 },
  // WINE
  { department: 'WINE', departmentCode: 50, name: 'Argentina', categoryCode: 501 },
  { department: 'WINE', departmentCode: 50, name: 'Australia', categoryCode: 502 },
  { department: 'WINE', departmentCode: 50, name: 'Austria', categoryCode: 503 },
  { department: 'WINE', departmentCode: 50, name: 'Bordeaux', categoryCode: 504 },
  { department: 'WINE', departmentCode: 50, name: 'Burgundy', categoryCode: 505 },
  { department: 'WINE', departmentCode: 50, name: 'Canada', categoryCode: 506 },
  { department: 'WINE', departmentCode: 50, name: 'Champagne', categoryCode: 507 },
  { department: 'WINE', departmentCode: 50, name: 'Chile', categoryCode: 508 },
  { department: 'WINE', departmentCode: 50, name: 'Czech Republic', categoryCode: 509 },
  { department: 'WINE', departmentCode: 50, name: 'France', categoryCode: 510 },
  { department: 'WINE', departmentCode: 50, name: 'Germany', categoryCode: 511 },
  { department: 'WINE', departmentCode: 50, name: 'Italy', categoryCode: 512 },
  { department: 'WINE', departmentCode: 50, name: 'New Zealand', categoryCode: 514 },
  { department: 'WINE', departmentCode: 50, name: 'Portugal', categoryCode: 515 },
  { department: 'WINE', departmentCode: 50, name: 'South Africa', categoryCode: 516 },
  { department: 'WINE', departmentCode: 50, name: 'Spain', categoryCode: 517 },
  { department: 'WINE', departmentCode: 50, name: 'Sparkling Wine', categoryCode: 518 },
  { department: 'WINE', departmentCode: 50, name: 'Usa', categoryCode: 519 },
  { department: 'WINE', departmentCode: 50, name: 'House Wine', categoryCode: 520 },
  { department: 'WINE', departmentCode: 50, name: 'Wine Event', categoryCode: 521 },
  { department: 'WINE', departmentCode: 50, name: 'Wine Promo', categoryCode: 522 },
  { department: 'WINE', departmentCode: 50, name: 'U+Reward Wine', categoryCode: 524 },
  { department: 'WINE', departmentCode: 50, name: 'Set Menu Wine', categoryCode: 547 },
  // MIL WINE
  { department: 'WINE', departmentCode: 50, name: 'MIL Argentina', categoryCode: 526 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Australia', categoryCode: 527 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Austria', categoryCode: 528 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Bordeaux', categoryCode: 529 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Burgundy', categoryCode: 530 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Canada', categoryCode: 531 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Champagne', categoryCode: 532 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Usa', categoryCode: 533 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Chile', categoryCode: 534 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Czech Republic', categoryCode: 535 },
  { department: 'WINE', departmentCode: 50, name: 'MIL France', categoryCode: 536 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Germany', categoryCode: 537 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Portugal', categoryCode: 538 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Italy', categoryCode: 539 },
  { department: 'WINE', departmentCode: 50, name: 'MIL New Zealand', categoryCode: 540 },
  { department: 'WINE', departmentCode: 50, name: 'MIL South Africa', categoryCode: 541 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Spain', categoryCode: 542 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Sparkling Wine', categoryCode: 543 },
  { department: 'WINE', departmentCode: 50, name: 'MIL House Wine', categoryCode: 544 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Wine Event', categoryCode: 545 },
  { department: 'WINE', departmentCode: 50, name: 'MIL Wine Promo', categoryCode: 546 },
  { department: 'WINE', departmentCode: 50, name: 'MIL U+Reward Wine', categoryCode: 547 },
  // PASTRY
  { department: 'PASTRY', departmentCode: 60, name: 'Pastry Dessert', categoryCode: 601 },
  { department: 'PASTRY', departmentCode: 60, name: 'Pastry Whole', categoryCode: 602 },
  { department: 'PASTRY', departmentCode: 60, name: 'Pastry Slice', categoryCode: 603 },
  { department: 'PASTRY', departmentCode: 60, name: 'Pastry Promo', categoryCode: 605 },
  { department: 'PASTRY', departmentCode: 60, name: 'Pastry Waste', categoryCode: 607 },
  { department: 'PASTRY', departmentCode: 60, name: 'Pastry Modifier', categoryCode: 608 },
  { department: 'PASTRY', departmentCode: 60, name: 'Pastry Refill', categoryCode: 609 },
  { department: 'PASTRY', departmentCode: 60, name: 'Additional Pastry', categoryCode: 610 },
  { department: 'PASTRY', departmentCode: 60, name: 'U+Reward Pastry', categoryCode: 611 },
  // MIL PASTRY
  { department: 'PASTRY', departmentCode: 60, name: 'MIL Pastry Dessert', categoryCode: 612 },
  { department: 'PASTRY', departmentCode: 60, name: 'MIL Pastry Whole', categoryCode: 613 },
  { department: 'PASTRY', departmentCode: 60, name: 'MIL Pastry Slice', categoryCode: 614 },
  { department: 'PASTRY', departmentCode: 60, name: 'MIL Pastry Promo', categoryCode: 617 },
  { department: 'PASTRY', departmentCode: 60, name: 'MIL Pastry Waste', categoryCode: 618 },
  { department: 'PASTRY', departmentCode: 60, name: 'MIL Pastry Modifier', categoryCode: 619 },
  { department: 'PASTRY', departmentCode: 60, name: 'MIL Pastry Refill', categoryCode: 620 },
  { department: 'PASTRY', departmentCode: 60, name: 'MIL Additional Pastry', categoryCode: 621 },
  { department: 'PASTRY', departmentCode: 60, name: 'MIL U+Reward Pastry', categoryCode: 622 },
  // BAKERY
  { department: 'BAKERY', departmentCode: 70, name: 'Bread', categoryCode: 701 },
  { department: 'BAKERY', departmentCode: 70, name: 'Brioche', categoryCode: 702 },
  { department: 'BAKERY', departmentCode: 70, name: 'Croisant', categoryCode: 703 },
  { department: 'BAKERY', departmentCode: 70, name: 'Donut', categoryCode: 704 },
  { department: 'BAKERY', departmentCode: 70, name: 'Bakery Promo', categoryCode: 705 },
  { department: 'BAKERY', departmentCode: 70, name: 'Waste Bakery', categoryCode: 706 },
  { department: 'BAKERY', departmentCode: 70, name: 'Modifier Bakery', categoryCode: 707 },
  // MIL BAKERY
  { department: 'BAKERY', departmentCode: 70, name: 'MIL Bread', categoryCode: 615 },
  { department: 'BAKERY', departmentCode: 70, name: 'MIL Brioche', categoryCode: 616 },
  { department: 'BAKERY', departmentCode: 70, name: 'MIL Croisant', categoryCode: 709 },
  { department: 'BAKERY', departmentCode: 70, name: 'MIL Donut', categoryCode: 710 },
  { department: 'BAKERY', departmentCode: 70, name: 'MIL Bakery Promo', categoryCode: 711 },
  { department: 'BAKERY', departmentCode: 70, name: 'MIL Waste Bakery', categoryCode: 712 },
  { department: 'BAKERY', departmentCode: 70, name: 'MIL Modifier Bakery', categoryCode: 713 },
  // CIGAR-ETTES
  { department: 'CIGAR-ETTES', departmentCode: 80, name: 'Cigar', categoryCode: 801 },
  { department: 'CIGAR-ETTES', departmentCode: 80, name: 'Cigarette', categoryCode: 802 },
  { department: 'CIGAR-ETTES', departmentCode: 80, name: 'MIL Cigar', categoryCode: 803 },
  { department: 'CIGAR-ETTES', departmentCode: 80, name: 'MIL Cigarette', categoryCode: 804 },
  // MISCELLANEOUS
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'Merchandise', categoryCode: 901 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'Corkage', categoryCode: 902 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'Delivery Fee', categoryCode: 903 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'Add General Supplies', categoryCode: 904 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'Modifier Miscellaneous', categoryCode: 905 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'Retail', categoryCode: 906 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'MIL Merchandise', categoryCode: 907 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'MIL Corkage', categoryCode: 908 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'MIL Delivery Fee', categoryCode: 909 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'MIL Add General Supplies', categoryCode: 910 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'MIL Modifier Miscellaneous', categoryCode: 911 },
  { department: 'MISCELLANEOUS', departmentCode: 90, name: 'MIL Retail', categoryCode: 912 },
];

// ── Entry point ───────────────────────────────────────────────────────────────

loadEnv();

async function main() {
  console.log('Seeding config tables through sql.js...');
  console.log('DB path:', process.env.DATABASE_URL ?? 'file:./dev.db (default)');

  await seedOutletConfigs(OUTLETS);
  console.log(`Upserted ${OUTLETS.length} outlets`);

  await seedPrinterConfigs(PRINTERS);
  console.log(`Upserted ${PRINTERS.length} printers`);

  await seedCategoryConfigs(CATEGORIES);
  console.log(`Upserted ${CATEGORIES.length} categories`);

  console.log('Done. Restart the dev server once to pick up the changes.');
}

main().catch((e) => { console.error(e); process.exit(1); });
