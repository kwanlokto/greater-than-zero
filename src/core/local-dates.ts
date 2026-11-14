// The phone's local calendar dates, as YYYY-MM-DD, and months, as YYYY-MM: all
// the date maths in one place. Nothing here reads the clock. Whoever needs
// today passes it in: screens get it from useToday, the core from its clock.

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

// YYYY-MM-DD in the phone's time zone, so a late-night session counts toward
// the day it happened. Screens use it for today's date.
export function localDateOf(time: Date): string {
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
}

// A local date's year, month (1 to 12) and day of the month. Only for a real
// date: check text from outside, such as a link, with isLocalDate first.
export function partsOf(localDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = localDate.split('-').map(Number);
  return { year, month, day };
}

// The start of a local date on the phone's clock, or `hours` and `minutes`
// into it.
export function dateOn(localDate: string, hours = 0, minutes = 0): Date {
  const { year, month, day } = partsOf(localDate);
  return new Date(year, month - 1, day, hours, minutes);
}

// Whether text is a real date as YYYY-MM-DD. Anything else doesn't come back
// the same: a day past its month's end rolls into the next month, and text
// that isn't a date isn't one.
export function isLocalDate(text: string): boolean {
  return localDateOf(dateOn(text)) === text;
}

// The local date `days` after this one, or before it when negative.
export function addDays(localDate: string, days: number): string {
  const { year, month, day } = partsOf(localDate);
  // Date rolls days past a month's end into the next month, and back.
  return localDateOf(new Date(year, month - 1, day + days));
}

// Where a local date stands against today, which is passed in.
export function relativeToToday(localDate: string, today: string): 'past' | 'today' | 'ahead' {
  // YYYY-MM-DD dates compare in order as text.
  if (localDate < today) return 'past';
  return localDate === today ? 'today' : 'ahead';
}

// A local date as a count of days, for spacing dates by how far apart they
// are.
export function dayNumberOf(localDate: string): number {
  const { year, month, day } = partsOf(localDate);
  // In UTC, so a change of the clocks between two dates doesn't make a day 23
  // or 25 hours long.
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

// The YYYY-MM month a local date is in.
export function monthOf(localDate: string): string {
  return localDate.slice(0, 7);
}

// The local date a YYYY-MM month starts on.
export function firstDayOf(month: string): string {
  return `${month}-01`;
}

// The YYYY-MM month `months` after this one, or before it when negative.
export function addMonths(month: string, months: number): string {
  const { year, month: monthNumber } = partsOf(firstDayOf(month));
  // Date rolls months past December or before January into the next year.
  return monthOf(localDateOf(new Date(year, monthNumber - 1 + months, 1)));
}

// A month's local dates in rows of a week, Sunday to Saturday, with null for
// the places before its first day and after its last.
export function calendarWeeks(month: string): (string | null)[][] {
  const first = firstDayOf(month);
  const places: (string | null)[] = Array(dateOn(first).getDay()).fill(null);
  for (let date = first; monthOf(date) === month; date = addDays(date, 1)) places.push(date);
  while (places.length % 7 !== 0) places.push(null);
  const weeks = [];
  for (let start = 0; start < places.length; start += 7) weeks.push(places.slice(start, start + 7));
  return weeks;
}
