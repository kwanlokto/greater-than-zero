// Run in America/Toronto (see jest.config.js), whose clocks change.
import {
  addDays,
  addMonths,
  calendarWeeks,
  dateOn,
  dayNumberOf,
  isLocalDate,
  localDateOf,
  relativeToToday,
} from './local-dates';

describe('Local dates', () => {
  it("counts a late-night time toward the day it's on, in the phone's time zone", () => {
    // 11:30 pm in Toronto, already the next day in UTC.
    expect(localDateOf(new Date('2026-11-14T04:30:00Z'))).toBe('2026-11-13');
  });

  it('accepts only real dates written as YYYY-MM-DD', () => {
    expect(isLocalDate('2026-11-14')).toBe(true);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-1-5')).toBe(false);
    expect(isLocalDate('abc')).toBe(false);
    expect(isLocalDate('')).toBe(false);
  });

  it('gives the start of a date, or a time on it', () => {
    expect(dateOn('2026-03-08')).toEqual(new Date(2026, 2, 8));
    expect(dateOn('2026-03-08', 18, 5)).toEqual(new Date(2026, 2, 8, 18, 5));
  });

  it('steps days across the end of a month, a year and a change of the clocks', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    // The clocks go forward on 8 March 2026 and back on 1 November.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('says whether a date is before today, today or ahead of it', () => {
    expect(relativeToToday('2026-11-13', '2026-11-14')).toBe('past');
    expect(relativeToToday('2025-12-31', '2026-11-14')).toBe('past');
    expect(relativeToToday('2026-11-14', '2026-11-14')).toBe('today');
    expect(relativeToToday('2026-11-15', '2026-11-14')).toBe('ahead');
  });

  it('counts whole days between dates, even across a change of the clocks', () => {
    expect(dayNumberOf('2026-03-09') - dayNumberOf('2026-03-07')).toBe(2);
    expect(dayNumberOf('2026-11-02') - dayNumberOf('2026-10-31')).toBe(2);
    expect(dayNumberOf('2027-01-01') - dayNumberOf('2026-01-01')).toBe(365);
  });

  it('steps months across the end of a year', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', -12)).toBe('2025-11');
  });

  it('lays a month out in weeks from Sunday, with gaps around it', () => {
    // 1 September 2026 is a Tuesday, and the 30th a Wednesday.
    const weeks = calendarWeeks('2026-09');

    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      null,
      null,
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
    expect(weeks[4]).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      null,
      null,
      null,
    ]);
    expect(weeks.flat().filter(date => date !== null)).toHaveLength(30);
  });

  it('fills exactly four weeks for a February starting on a Sunday', () => {
    const weeks = calendarWeeks('2026-02');

    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2026-02-01');
    expect(weeks[3][6]).toBe('2026-02-28');
  });
});
