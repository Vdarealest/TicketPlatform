export type SaleStatus = 'DRAFT' | 'UPCOMING' | 'ON_SALE';

/**
 * The real, time-aware sale status. An UPCOMING event whose saleOpenAt has
 * passed counts as ON_SALE — so sales open automatically at the set time,
 * while admins can still flip status manually at any point.
 */
export function effectiveSaleStatus(event: {
  status?: string | null;
  saleOpenAt?: Date | string | null;
}): SaleStatus {
  const status = (event.status as SaleStatus) || 'ON_SALE';
  if (status === 'ON_SALE') return 'ON_SALE';
  if (status === 'DRAFT') return 'DRAFT';
  // UPCOMING
  if (event.saleOpenAt && Date.now() >= new Date(event.saleOpenAt).getTime()) {
    return 'ON_SALE';
  }
  return 'UPCOMING';
}
