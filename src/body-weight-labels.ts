import type { Weight } from '@/core/tracker';

// "82.4 kg": a body weight as the core gives it to show.
export function formatBodyWeight({ value, unit }: Weight): string {
  return `${value} ${unit}`;
}
