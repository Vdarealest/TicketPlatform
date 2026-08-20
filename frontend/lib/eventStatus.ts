export type SaleStatus = 'DRAFT' | 'UPCOMING' | 'ON_SALE' | 'ENDED';

// Time-aware sale status — mirrors the backend. An UPCOMING event whose
// saleOpenAt has passed is treated as ON_SALE. An event whose endTime has
// passed is treated as ENDED regardless of the stored status, so sales
// close automatically once the event is over.
export function effectiveSaleStatus(ev?: {
  status?: string | null;
  saleOpenAt?: string | null;
  endTime?: string | null;
}): SaleStatus {
  const status = (ev?.status as SaleStatus) || 'ON_SALE';
  if (status === 'DRAFT') return 'DRAFT';
  if (ev?.endTime && Date.now() >= new Date(ev.endTime).getTime()) {
    return 'ENDED';
  }
  if (status === 'ON_SALE') return 'ON_SALE';
  if (ev?.saleOpenAt && Date.now() >= new Date(ev.saleOpenAt).getTime()) {
    return 'ON_SALE';
  }
  return 'UPCOMING';
}

export function isOnSale(ev?: { status?: string | null; saleOpenAt?: string | null }): boolean {
  return effectiveSaleStatus(ev) === 'ON_SALE';
}

// Vietnamese label for the "coming soon" banner/tag, incl. the open date if set.
export function upcomingLabel(saleOpenAt?: string | null, lang: 'vi' | 'en' = 'vi'): string {
  if (!saleOpenAt) return lang === 'en' ? 'Coming soon' : 'Sắp mở bán';
  const d = new Date(saleOpenAt).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN', {
    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return lang === 'en' ? `On sale ${d}` : `Mở bán ${d}`;
}
