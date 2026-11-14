// Dates and times in words. The date maths behind them is in core/local-dates.ts.

import { dateOn, firstDayOf, partsOf } from '@/core/tracker';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// A YYYY-MM-DD local date as "11 Sep", with the year when it isn't this year.
// The clock is read only for that.
export function formatLocalDate(localDate: string): string {
  const { year, month, day } = partsOf(localDate);
  const dayAndMonth = `${day} ${monthNames[month - 1].slice(0, 3)}`;
  return year === new Date().getFullYear() ? dayAndMonth : `${dayAndMonth} ${year}`;
}

// A YYYY-MM-DD local date as "Friday 11 Sep", with the year when it isn't this
// year.
export function formatLocalDateWithWeekday(localDate: string): string {
  return `${weekdayNames[dateOn(localDate).getDay()]} ${formatLocalDate(localDate)}`;
}

// A YYYY-MM month as "September 2026".
export function formatMonth(month: string): string {
  const { year, month: monthNumber } = partsOf(firstDayOf(month));
  return `${monthNames[monthNumber - 1]} ${year}`;
}

// Headings for the columns of calendarWeeks in the core: S, M, T…
export const weekdayInitials = weekdayNames.map(name => name[0]);

// A time of day in the phone's own style, e.g. "6:05 PM".
export function formatTimeOfDay(time: Date): string {
  return time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

