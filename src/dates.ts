const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// A YYYY-MM-DD local date as "11 Sep", with the year when it isn't this year.
export function formatLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const dayAndMonth = `${day} ${monthNames[month - 1]}`;
  return year === new Date().getFullYear() ? dayAndMonth : `${dayAndMonth} ${year}`;
}
