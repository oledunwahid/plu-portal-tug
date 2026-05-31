import { getOutletConfigs, getPrinterConfigs, getCategoryConfigs } from '@/lib/db';
import { OUTLET_TO_PREFIX } from '@/lib/pluCode';

export async function loadOutletPrefixMap(): Promise<Record<string, string>> {
  try {
    const outlets = await getOutletConfigs();
    const active = outlets.filter((o) => o.isActive);
    if (active.length === 0) {
      console.error('[configLoader] loadOutletPrefixMap: no active outlets in DB');
      return {};
    }
    const map: Record<string, string> = {};
    for (const outlet of active) {
      map[outlet.code] = OUTLET_TO_PREFIX[outlet.code] ?? 'UNI';
    }
    return map;
  } catch (err) {
    console.error('[configLoader] loadOutletPrefixMap failed:', err);
    return {};
  }
}

export async function loadCategoryCodeMap(): Promise<Record<string, { department: string; departmentCode: number; categoryCode: number }>> {
  try {
    const categories = await getCategoryConfigs();
    const active = categories.filter((c) => c.isActive);
    if (active.length === 0) {
      console.error('[configLoader] loadCategoryCodeMap: no active categories in DB');
      return {};
    }
    const map: Record<string, { department: string; departmentCode: number; categoryCode: number }> = {};
    for (const cat of active) {
      map[cat.name] = { department: cat.department, departmentCode: cat.departmentCode, categoryCode: cat.categoryCode };
    }
    return map;
  } catch (err) {
    console.error('[configLoader] loadCategoryCodeMap failed:', err);
    return {};
  }
}

export async function loadPrintersForGroup(_group: string): Promise<string[]> {
  try {
    const printers = await getPrinterConfigs();
    const active = printers.filter((p) => p.isActive).map((p) => p.name);
    if (active.length === 0) {
      console.error('[configLoader] loadPrintersForGroup: no active printers in DB');
    }
    return active;
  } catch (err) {
    console.error('[configLoader] loadPrintersForGroup failed:', err);
    return [];
  }
}

export async function loadOutletsForGroup(group: string): Promise<string[]> {
  try {
    const outlets = await getOutletConfigs();
    const result = outlets.filter((o) => o.isActive && o.group === group).map((o) => o.code);
    if (result.length === 0) {
      console.error(`[configLoader] loadOutletsForGroup: no active outlets for group "${group}"`);
    }
    return result;
  } catch (err) {
    console.error('[configLoader] loadOutletsForGroup failed:', err);
    return [];
  }
}
