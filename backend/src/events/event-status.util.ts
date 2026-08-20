export type SaleStatus = 'DRAFT' | 'UPCOMING' | 'ON_SALE' | 'ENDED';

/**
 * The real, time-aware sale status. An UPCOMING event whose saleOpenAt has
 * passed counts as ON_SALE — so sales open automatically at the set time,
 * while admins can still flip status manually at any point. An event whose
 * endTime has passed counts as ENDED regardless of the stored status, so
 * sales close automatically once the event is over.
 */
export function effectiveSaleStatus(event: {
  status?: string | null;
  saleOpenAt?: Date | string | null;
  endTime?: Date | string | null;
}): SaleStatus {
  const status = (event.status as SaleStatus) || 'ON_SALE';
  if (status === 'DRAFT') return 'DRAFT';
  if (event.endTime && Date.now() >= new Date(event.endTime).getTime()) {
    return 'ENDED';
  }
  if (status === 'ON_SALE') return 'ON_SALE';
  // UPCOMING
  if (event.saleOpenAt && Date.now() >= new Date(event.saleOpenAt).getTime()) {
    return 'ON_SALE';
  }
  return 'UPCOMING';
}
