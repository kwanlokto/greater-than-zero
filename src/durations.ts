// Seconds as "m:ss", e.g. 90 → "1:30". Part-seconds count as a whole second,
// so a countdown shows 0:01 until the moment it ends.
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
