// The requester behind a reservation/payment action: either a logged-in user
// (from the JWT, via OptionalJwtAuthGuard) or a guest holding the one-time
// token handed back when their reservation was created.
export interface Requester {
  userId?: number;
  guestToken?: string;
}

export function ownsReservation(
  reservation: { user?: { id: number } | null; guestToken?: string | null },
  requester: Requester,
): boolean {
  if (reservation.user) {
    return reservation.user.id === requester.userId;
  }
  // Guest reservation: both sides must present the same non-empty token.
  // Never fall through on a missing token — an absent guestToken must not
  // match an absent one.
  return (
    !!requester.guestToken && requester.guestToken === reservation.guestToken
  );
}
