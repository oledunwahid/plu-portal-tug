export interface CategoryCodeEntry {
  department: string
  departmentCode: number
  category: string
  categoryCode: number
}

export const CATEGORY_CODE_MAP: CategoryCodeEntry[] = [
  // FOOD
  { department: 'FOOD', departmentCode: 10, category: 'Asian', categoryCode: 101 },
  { department: 'FOOD', departmentCode: 10, category: 'Grilled', categoryCode: 102 },
  { department: 'FOOD', departmentCode: 10, category: 'Mains', categoryCode: 103 },
  { department: 'FOOD', departmentCode: 10, category: 'Pasta', categoryCode: 104 },
  { department: 'FOOD', departmentCode: 10, category: 'Sandwich', categoryCode: 106 },
  { department: 'FOOD', departmentCode: 10, category: 'Snack', categoryCode: 107 },
  { department: 'FOOD', departmentCode: 10, category: 'Starter', categoryCode: 108 },
  { department: 'FOOD', departmentCode: 10, category: 'Side Dishes', categoryCode: 109 },
  { department: 'FOOD', departmentCode: 10, category: 'Salad', categoryCode: 110 },
  { department: 'FOOD', departmentCode: 10, category: 'Dessert Food', categoryCode: 111 },
  { department: 'FOOD', departmentCode: 10, category: 'Special', categoryCode: 112 },
  { department: 'FOOD', departmentCode: 10, category: 'Food Event', categoryCode: 113 },
  { department: 'FOOD', departmentCode: 10, category: 'Food Promo', categoryCode: 114 },
  { department: 'FOOD', departmentCode: 10, category: 'Additional Food', categoryCode: 116 },
  { department: 'FOOD', departmentCode: 10, category: 'Special Feast', categoryCode: 117 },
  { department: 'FOOD', departmentCode: 10, category: 'Breakfast', categoryCode: 118 },
  { department: 'FOOD', departmentCode: 10, category: 'Pizza', categoryCode: 119 },
  { department: 'FOOD', departmentCode: 10, category: 'Modifier Food', categoryCode: 120 },
  { department: 'FOOD', departmentCode: 10, category: 'U+Reward Food', categoryCode: 121 },
  { department: 'FOOD', departmentCode: 10, category: 'Tapas', categoryCode: 122 },
  { department: 'FOOD', departmentCode: 10, category: 'Brunch', categoryCode: 123 },
  { department: 'FOOD', departmentCode: 10, category: 'Complimentary Food', categoryCode: 124 },
  { department: 'FOOD', departmentCode: 10, category: 'Set Menu', categoryCode: 125 },
  // ALCOHOLIC BEVERAGES
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Aperitif and Liqueur', categoryCode: 201 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Beer', categoryCode: 202 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Brandy and Cognac', categoryCode: 203 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Gin', categoryCode: 204 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Rum', categoryCode: 205 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Tequila and Mezcal', categoryCode: 207 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Vodka', categoryCode: 208 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Whisk(e)y', categoryCode: 209 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Beverages Promo', categoryCode: 211 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'Modifier Spirit', categoryCode: 213 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'U+Reward Beverages', categoryCode: 214 },
  // COCKTAILS
  { department: 'COCKTAILS', departmentCode: 30, category: 'Cocktails Classic', categoryCode: 301 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'Cocktails Signature', categoryCode: 302 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'Cocktails Event', categoryCode: 303 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'Cocktails Promo', categoryCode: 304 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'Modifier Cocktail', categoryCode: 305 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'U+Reward Cocktails', categoryCode: 306 },
  // NON ALCOHOLIC BEVERAGES
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Coffee', categoryCode: 401 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Mocktails and Smoothies', categoryCode: 402 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Mineral Water', categoryCode: 403 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Soft Drink', categoryCode: 404 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Juices', categoryCode: 405 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Tea', categoryCode: 406 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Mixer', categoryCode: 407 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Beverages Modifier', categoryCode: 408 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Beverages Promo Non Alcohol', categoryCode: 409 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'Additional Bev Non Alcohol', categoryCode: 410 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'U+Reward Beverages Non Alcohol', categoryCode: 411 },
  // WINE
  { department: 'WINE', departmentCode: 50, category: 'Argentina', categoryCode: 501 },
  { department: 'WINE', departmentCode: 50, category: 'Australia', categoryCode: 502 },
  { department: 'WINE', departmentCode: 50, category: 'Austria', categoryCode: 503 },
  { department: 'WINE', departmentCode: 50, category: 'Bordeaux', categoryCode: 504 },
  { department: 'WINE', departmentCode: 50, category: 'Burgundy', categoryCode: 505 },
  { department: 'WINE', departmentCode: 50, category: 'Canada', categoryCode: 506 },
  { department: 'WINE', departmentCode: 50, category: 'Champagne', categoryCode: 507 },
  { department: 'WINE', departmentCode: 50, category: 'Chile', categoryCode: 508 },
  { department: 'WINE', departmentCode: 50, category: 'Czech Republic', categoryCode: 509 },
  { department: 'WINE', departmentCode: 50, category: 'France', categoryCode: 510 },
  { department: 'WINE', departmentCode: 50, category: 'Germany', categoryCode: 511 },
  { department: 'WINE', departmentCode: 50, category: 'Italy', categoryCode: 512 },
  { department: 'WINE', departmentCode: 50, category: 'New Zealand', categoryCode: 514 },
  { department: 'WINE', departmentCode: 50, category: 'Portugal', categoryCode: 515 },
  { department: 'WINE', departmentCode: 50, category: 'South Africa', categoryCode: 516 },
  { department: 'WINE', departmentCode: 50, category: 'Spain', categoryCode: 517 },
  { department: 'WINE', departmentCode: 50, category: 'Sparkling Wine', categoryCode: 518 },
  { department: 'WINE', departmentCode: 50, category: 'Usa', categoryCode: 519 },
  { department: 'WINE', departmentCode: 50, category: 'House Wine', categoryCode: 520 },
  { department: 'WINE', departmentCode: 50, category: 'Wine Event', categoryCode: 521 },
  { department: 'WINE', departmentCode: 50, category: 'Wine Promo', categoryCode: 522 },
  { department: 'WINE', departmentCode: 50, category: 'U+Reward Wine', categoryCode: 524 },
  { department: 'WINE', departmentCode: 50, category: 'Set Menu Wine', categoryCode: 547 },
  // PASTRY
  { department: 'PASTRY', departmentCode: 60, category: 'Pastry Dessert', categoryCode: 601 },
  { department: 'PASTRY', departmentCode: 60, category: 'Pastry Whole', categoryCode: 602 },
  { department: 'PASTRY', departmentCode: 60, category: 'Pastry Slice', categoryCode: 603 },
  { department: 'PASTRY', departmentCode: 60, category: 'Pastry Promo', categoryCode: 605 },
  { department: 'PASTRY', departmentCode: 60, category: 'Pastry Waste', categoryCode: 607 },
  { department: 'PASTRY', departmentCode: 60, category: 'Pastry Modifier', categoryCode: 608 },
  { department: 'PASTRY', departmentCode: 60, category: 'Pastry Refill', categoryCode: 609 },
  { department: 'PASTRY', departmentCode: 60, category: 'Additional Pastry', categoryCode: 610 },
  { department: 'PASTRY', departmentCode: 60, category: 'U+Reward Pastry', categoryCode: 611 },
  // BAKERY
  { department: 'BAKERY', departmentCode: 70, category: 'Bread', categoryCode: 701 },
  { department: 'BAKERY', departmentCode: 70, category: 'Brioche', categoryCode: 702 },
  { department: 'BAKERY', departmentCode: 70, category: 'Croisant', categoryCode: 703 },
  { department: 'BAKERY', departmentCode: 70, category: 'Donut', categoryCode: 704 },
  { department: 'BAKERY', departmentCode: 70, category: 'Bakery Promo', categoryCode: 705 },
  { department: 'BAKERY', departmentCode: 70, category: 'Waste Bakery', categoryCode: 706 },
  { department: 'BAKERY', departmentCode: 70, category: 'Modifier Bakery', categoryCode: 707 },
  // CIGAR-ETTES
  { department: 'CIGAR-ETTES', departmentCode: 80, category: 'Cigar', categoryCode: 801 },
  { department: 'CIGAR-ETTES', departmentCode: 80, category: 'Cigarette', categoryCode: 802 },
  // MISCELLANEOUS
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'Merchandise', categoryCode: 901 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'Corkage', categoryCode: 902 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'Delivery Fee', categoryCode: 903 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'Add General Supplies', categoryCode: 904 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'Modifier Miscellaneous', categoryCode: 905 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'Retail', categoryCode: 906 },
  // MIL FOOD (dept 10, codes 126+)
  { department: 'FOOD', departmentCode: 10, category: 'MIL Asian', categoryCode: 126 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Grilled', categoryCode: 127 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Mains', categoryCode: 128 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Pasta', categoryCode: 129 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Sandwich', categoryCode: 130 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Snack', categoryCode: 131 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Starter', categoryCode: 132 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Side Dishes', categoryCode: 133 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Salad', categoryCode: 134 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Dessert Food', categoryCode: 135 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Lunch Specials', categoryCode: 136 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Special', categoryCode: 137 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Food Event', categoryCode: 138 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Food Promo', categoryCode: 139 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Additional Food', categoryCode: 140 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Special Feast', categoryCode: 141 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Breakfast', categoryCode: 142 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Pizza', categoryCode: 143 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Modifier Food', categoryCode: 144 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL U+Reward Food', categoryCode: 145 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Tapas', categoryCode: 146 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Brunch', categoryCode: 147 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Complimentary Food', categoryCode: 148 },
  { department: 'FOOD', departmentCode: 10, category: 'MIL Set Menu', categoryCode: 149 },
  // MIL Alcoholic (dept 20, codes 215+)
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Aperitif and Liqueur', categoryCode: 215 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Beer', categoryCode: 216 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Brandy and Cognac', categoryCode: 217 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Gin', categoryCode: 218 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Rum', categoryCode: 219 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Tequila and Mezcal', categoryCode: 220 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Vodka', categoryCode: 221 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Whisk(e)y', categoryCode: 222 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Beverages Promo', categoryCode: 223 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL Modifier Spirit', categoryCode: 224 },
  { department: 'ALCOHOLIC BEVERAGES', departmentCode: 20, category: 'MIL U+Reward Beverages', categoryCode: 225 },
  // MIL Cocktails (dept 30, codes 307+)
  { department: 'COCKTAILS', departmentCode: 30, category: 'MIL Cocktails Classic', categoryCode: 307 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'MIL Cocktails Signature', categoryCode: 308 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'MIL Cocktails Event', categoryCode: 309 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'MIL Cocktails Promo', categoryCode: 310 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'MIL Modifier Cocktail', categoryCode: 311 },
  { department: 'COCKTAILS', departmentCode: 30, category: 'MIL U+Reward Cocktails', categoryCode: 312 },
  // MIL Non Alcoholic (dept 40, codes 413+)
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Additional Bev Non Alcohol', categoryCode: 413 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Coffee', categoryCode: 414 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Mocktails and Smoothies', categoryCode: 415 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Tea', categoryCode: 416 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Mineral Water', categoryCode: 417 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Soft Drink', categoryCode: 418 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Juices', categoryCode: 419 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Mixer', categoryCode: 420 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Beverages Modifier', categoryCode: 421 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Beverages Promo Non Alcohol', categoryCode: 422 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL U+Reward Beverages Non Alcohol', categoryCode: 423 },
  { department: 'NON ALCOHOLIC BEVERAGES', departmentCode: 40, category: 'MIL Beverages Event Non Alcohol', categoryCode: 424 },
  // MIL Wine (dept 50, codes 526+)
  { department: 'WINE', departmentCode: 50, category: 'MIL Argentina', categoryCode: 526 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Australia', categoryCode: 527 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Austria', categoryCode: 528 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Bordeaux', categoryCode: 529 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Burgundy', categoryCode: 530 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Canada', categoryCode: 531 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Champagne', categoryCode: 532 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Usa', categoryCode: 533 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Chile', categoryCode: 534 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Czech Republic', categoryCode: 535 },
  { department: 'WINE', departmentCode: 50, category: 'MIL France', categoryCode: 536 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Germany', categoryCode: 537 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Portugal', categoryCode: 538 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Italy', categoryCode: 539 },
  { department: 'WINE', departmentCode: 50, category: 'MIL New Zealand', categoryCode: 540 },
  { department: 'WINE', departmentCode: 50, category: 'MIL South Africa', categoryCode: 541 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Spain', categoryCode: 542 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Sparkling Wine', categoryCode: 543 },
  { department: 'WINE', departmentCode: 50, category: 'MIL House Wine', categoryCode: 544 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Wine Event', categoryCode: 545 },
  { department: 'WINE', departmentCode: 50, category: 'MIL Wine Promo', categoryCode: 546 },
  { department: 'WINE', departmentCode: 50, category: 'MIL U+Reward Wine', categoryCode: 547 },
  // MIL Pastry (dept 60, codes 612+)
  { department: 'PASTRY', departmentCode: 60, category: 'MIL Pastry Dessert', categoryCode: 612 },
  { department: 'PASTRY', departmentCode: 60, category: 'MIL Pastry Whole', categoryCode: 613 },
  { department: 'PASTRY', departmentCode: 60, category: 'MIL Pastry Slice', categoryCode: 614 },
  { department: 'PASTRY', departmentCode: 60, category: 'MIL Pastry Promo', categoryCode: 617 },
  { department: 'PASTRY', departmentCode: 60, category: 'MIL Pastry Waste', categoryCode: 618 },
  { department: 'PASTRY', departmentCode: 60, category: 'MIL Pastry Modifier', categoryCode: 619 },
  { department: 'PASTRY', departmentCode: 60, category: 'MIL Pastry Refill', categoryCode: 620 },
  { department: 'PASTRY', departmentCode: 60, category: 'MIL Additional Pastry', categoryCode: 621 },
  { department: 'PASTRY', departmentCode: 60, category: 'MIL U+Reward Pastry', categoryCode: 622 },
  // MIL Bakery (dept 70, codes 709+)
  { department: 'BAKERY', departmentCode: 70, category: 'MIL Bread', categoryCode: 615 },
  { department: 'BAKERY', departmentCode: 70, category: 'MIL Brioche', categoryCode: 616 },
  { department: 'BAKERY', departmentCode: 70, category: 'MIL Croisant', categoryCode: 709 },
  { department: 'BAKERY', departmentCode: 70, category: 'MIL Donut', categoryCode: 710 },
  { department: 'BAKERY', departmentCode: 70, category: 'MIL Bakery Promo', categoryCode: 711 },
  { department: 'BAKERY', departmentCode: 70, category: 'MIL Waste Bakery', categoryCode: 712 },
  { department: 'BAKERY', departmentCode: 70, category: 'MIL Modifier Bakery', categoryCode: 713 },
  // MIL Cigars / Misc
  { department: 'CIGAR-ETTES', departmentCode: 80, category: 'MIL Cigar', categoryCode: 803 },
  { department: 'CIGAR-ETTES', departmentCode: 80, category: 'MIL Cigarette', categoryCode: 804 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'MIL Merchandise', categoryCode: 907 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'MIL Corkage', categoryCode: 908 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'MIL Delivery Fee', categoryCode: 909 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'MIL Add General Supplies', categoryCode: 910 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'MIL Modifier Miscellaneous', categoryCode: 911 },
  { department: 'MISCELLANEOUS', departmentCode: 90, category: 'MIL Retail', categoryCode: 912 },
]

export const OUTLET_TO_PREFIX: Record<string, string> = {
  // IBR Group
  ROMSCBD: 'ROM',
  ROMPIM:  'ROM',
  BISSCBD: 'BIS',
  BISPIK:  'BIS',
  MILGI:   'MIL',
  MILPIK:  'MIL',
  // Union Group
  UTP:    'UNI',
  UPKW:   'UNI',
  UPS:    'UNI',
  USC:    'UNI',
  UCP:    'UNI',
  UGI:    'UNI',
  UPIM:   'UNI',
  UPIK:   'UNI',
  UMKG:   'UNI',
  USMS:   'UNI',
  'UCP-B':  'UNI',
  'UPS-B':  'UNI',
  'USC-B':  'UNI',
  'UPIK-B': 'UNI',
  'UMKG-B': 'UNI',
  // CNS Group
  CSPI:     'CNS',
  CSPP:     'CNS',
  CSSG:     'CNS',
  'CSPI-B': 'CNS',
  'CSPP-B': 'CNS',
  'CSSG-B': 'CNS',
  BLCS:     'BLC',
  // French Group
  'LWY-OAK':   'LWY',
  'LWY-OAK-B': 'LWY',
  'BAB-SEN':   'BCH',
  'BAB-SEN-B': 'BCH',
  'PIE-SNPT':   'PIE',
  'PIE-SNPT-B': 'PIE',
}

const NEW_ITEM_SEQUENCE_START = 4000

// Departments eligible for TUG prefix when 2+ outlets selected.
// COCKTAILS, FOOD, BAKERY, PASTRY are excluded — always use outlet prefix.
// MIL variants share the same department string in CATEGORY_CODE_MAP so this covers them automatically.
const TUG_DEPARTMENTS = [
  'ALCOHOLIC BEVERAGES',
  'NON ALCOHOLIC BEVERAGES',
  'WINE',
  'CIGAR-ETTES',
  'MISCELLANEOUS',
]

const MIL_OUTLETS = new Set(['MILGI', 'MILPIK'])

export const KNOWN_PREFIXES = ['ROM', 'BCH', 'LWY', 'PIE', 'TUG', 'UNI', 'CNS', 'MIL', 'BIS', 'BLC']

export function assemblePLUCode(prefix: string, deptCode: string, catCode: string, sequence: number): string {
  const code = `${prefix}${deptCode}${catCode}${String(sequence).padStart(8, '0')}`
  if (code.length !== 16) console.error(`[PLU] Code length ${code.length} != 16 for "${code}"`)
  return code
}

export function suggestPLUCode(
  category: string,
  cashierOutlet: string,
  selectedOutlets: string[],
  sequence?: number,
): { code: string; prefix: string; reason: string; isTUG: boolean; deptCode: string; catCode: string } | null {
  const entry = CATEGORY_CODE_MAP.find((e) => e.category === category)
  if (!entry) return null

  const isMilOutlet = MIL_OUTLETS.has(cashierOutlet)
  const isMultiOutlet = selectedOutlets.length > 1
  const tugEligible = TUG_DEPARTMENTS.includes(entry.department)

  let prefix: string
  let isTUG = false
  let reason: string

  if (tugEligible && isMultiOutlet) {
    // TUG wins for ALL outlets (including MIL) when category is TUG-eligible + 2+ outlets
    prefix = 'TUG'
    isTUG = true
    reason = `TUG prefix: ${entry.department} item sold at multiple outlets`
  } else if (isMilOutlet) {
    // MIL outlet + single outlet, or non-TUG category
    prefix = 'MIL'
    reason = 'MIL prefix for Milano outlet'
  } else {
    // All other outlets
    prefix = OUTLET_TO_PREFIX[cashierOutlet] ?? 'UNI'
    const hasFallback = !(cashierOutlet in OUTLET_TO_PREFIX)
    reason = hasFallback
      ? `UNI fallback — outlet ${cashierOutlet} has no prefix mapping`
      : `${prefix} prefix for outlet ${cashierOutlet}`
  }

  const deptCode = String(entry.departmentCode).padStart(2, '0')
  const catCode  = String(entry.categoryCode).padStart(3, '0')
  const seq      = sequence ?? NEW_ITEM_SEQUENCE_START
  const code     = assemblePLUCode(prefix, deptCode, catCode, seq)
  return { code, prefix, reason, isTUG, deptCode, catCode }
}

export function hasFallbackPrefix(cashierOutlet: string): boolean {
  return !(cashierOutlet in OUTLET_TO_PREFIX) && !MIL_OUTLETS.has(cashierOutlet)
}
