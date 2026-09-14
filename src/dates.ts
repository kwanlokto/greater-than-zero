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

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

// A YYYY-MM-DD local date as "11 Sep", with the year when it isn't this year.
export function formatLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const dayAndMonth = `${day} ${monthNames[month - 1].slice(0, 3)}`;
  return year === new Date().getFullYear() ? dayAndMonth : `${dayAndMonth} ${year}`;
}

// A YYYY-MM-DD local date as "Friday 11 Sep", with the year when it isn't this
// year.
export function formatLocalDateWithWeekday(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return `${weekdayNames[new Date(year, month - 1, day).getDay()]} ${formatLocalDate(localDate)}`;
}

// The YYYY-MM month a YYYY-MM-DD local date is in.
export function monthOf(localDate: string): string {
  return localDate.slice(0, 7);
}

// A YYYY-MM month as "September 2026".
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${monthNames[monthNumber - 1]} ${year}`;
}

// The YYYY-MM month `by` months after this one, or before it when negative.
export function shiftMonth(month: string, by: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  // Date rolls months past December or before January into the next year.
  const shifted = new Date(year, monthNumber - 1 + by, 1);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
}

// A YYYY-MM month's local dates in rows of a week, Sunday to Saturday, with
// null for the places before its first day and after its last.
export function calendarWeeks(month: string): (string | null)[][] {
  const [year, monthNumber] = month.split('-').map(Number);
  const places: (string | null)[] = Array(new Date(year, monthNumber - 1, 1).getDay()).fill(null);
  // Day 0 of the next month is this month's last day.
  const dayCount = new Date(year, monthNumber, 0).getDate();
  for (let day = 1; day <= dayCount; day++) places.push(`${month}-${pad(day)}`);
  while (places.length % 7 !== 0) places.push(null);

  const weeks = [];
  for (let start = 0; start < places.length; start += 7) weeks.push(places.slice(start, start + 7));
  return weeks;
}

// A time of day in the phone's own style, e.g. "6:05 PM".
export function formatTimeOfDay(time: Date): string {
  return time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
