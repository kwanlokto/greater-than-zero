// Seconds as "m:ss", e.g. 90 → "1:30". Counts up part-seconds, so a countdown
// reaches 0:00 exactly when it ends.
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
