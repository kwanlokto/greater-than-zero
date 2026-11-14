import { formatLocalDate, formatLocalDateWithWeekday, formatMonth } from './dates';

describe('Date labels', () => {
  // They read the clock only to know this year.
  beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 10, 14, 9, 0) }));
  afterEach(() => jest.useRealTimers());

  it('leaves the year off a date this year', () => {
    expect(formatLocalDate('2026-09-11')).toBe('11 Sep');
  });

  it('adds the year to a date in another year', () => {
    expect(formatLocalDate('2025-12-31')).toBe('31 Dec 2025');
    expect(formatLocalDate('2027-01-01')).toBe('1 Jan 2027');
  });

  it('starts with the weekday when asked', () => {
    expect(formatLocalDateWithWeekday('2026-09-11')).toBe('Friday 11 Sep');
    expect(formatLocalDateWithWeekday('2025-12-31')).toBe('Wednesday 31 Dec 2025');
  });

  it('names a month with its year', () => {
    expect(formatMonth('2026-09')).toBe('September 2026');
    expect(formatMonth('2027-01')).toBe('January 2027');
  });
});
