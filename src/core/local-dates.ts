// The phone's local calendar dates.

// YYYY-MM-DD in the phone's time zone, so a late-night session counts toward
// the day it happened. Screens use it for today's date.
export function localDateOf(time: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
}
