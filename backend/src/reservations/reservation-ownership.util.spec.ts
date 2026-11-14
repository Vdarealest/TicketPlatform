import { ownsReservation } from './reservation-ownership.util';

describe('ownsReservation', () => {
  it('matches a user reservation only to that user', () => {
    const r = { user: { id: 7 }, guestToken: null };
    expect(ownsReservation(r, { userId: 7 })).toBe(true);
    expect(ownsReservation(r, { userId: 8 })).toBe(false);
    expect(ownsReservation(r, {})).toBe(false);
  });

  it('does not let a guest token unlock a user reservation', () => {
    const r = { user: { id: 7 }, guestToken: 'abc' };
    expect(ownsReservation(r, { guestToken: 'abc' })).toBe(false);
  });

  it('matches a guest reservation by its token', () => {
    const r = { user: null, guestToken: 'tok-1' };
    expect(ownsReservation(r, { guestToken: 'tok-1' })).toBe(true);
    expect(ownsReservation(r, { guestToken: 'tok-2' })).toBe(false);
  });

  it('never treats two missing tokens as a match', () => {
    expect(ownsReservation({ user: null, guestToken: null }, {})).toBe(false);
    expect(
      ownsReservation(
        { user: null, guestToken: undefined },
        { guestToken: undefined },
      ),
    ).toBe(false);
    expect(
      ownsReservation({ user: null, guestToken: '' }, { guestToken: '' }),
    ).toBe(false);
  });

  it('does not let a logged-in user claim a guest reservation', () => {
    expect(
      ownsReservation({ user: null, guestToken: 'tok' }, { userId: 1 }),
    ).toBe(false);
  });
});
