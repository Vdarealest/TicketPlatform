import { effectiveSaleStatus } from './event-status.util';

const HOUR = 60 * 60 * 1000;
const past = () => new Date(Date.now() - HOUR);
const future = () => new Date(Date.now() + HOUR);

describe('effectiveSaleStatus', () => {
  it('keeps DRAFT hidden even after the event or sale time has passed', () => {
    expect(effectiveSaleStatus({ status: 'DRAFT', endTime: past() })).toBe('DRAFT');
    expect(effectiveSaleStatus({ status: 'DRAFT', saleOpenAt: past() })).toBe('DRAFT');
  });

  it('treats a missing status as ON_SALE (legacy rows)', () => {
    expect(effectiveSaleStatus({ endTime: future() })).toBe('ON_SALE');
  });

  it('closes sales once the event has ended, whatever the stored status', () => {
    expect(effectiveSaleStatus({ status: 'ON_SALE', endTime: past() })).toBe('ENDED');
    expect(effectiveSaleStatus({ status: 'UPCOMING', endTime: past() })).toBe('ENDED');
  });

  it('opens an UPCOMING event automatically at saleOpenAt', () => {
    expect(effectiveSaleStatus({ status: 'UPCOMING', saleOpenAt: future(), endTime: future() })).toBe('UPCOMING');
    expect(effectiveSaleStatus({ status: 'UPCOMING', saleOpenAt: past(), endTime: future() })).toBe('ON_SALE');
  });

  it('keeps UPCOMING without a saleOpenAt until an admin flips it', () => {
    expect(effectiveSaleStatus({ status: 'UPCOMING', saleOpenAt: null, endTime: future() })).toBe('UPCOMING');
  });

  it('accepts ISO strings as well as Dates', () => {
    expect(effectiveSaleStatus({ status: 'ON_SALE', endTime: past().toISOString() })).toBe('ENDED');
  });
});
