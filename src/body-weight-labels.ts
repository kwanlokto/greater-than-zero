import type { BodyWeightTrend, TrendPoint, WeightUnit } from '@/core/tracker';
import { formatLocalDate } from '@/dates';

// "82.4 kg": a body weight as the core gives it to show.
export function formatBodyWeight(value: number, unit: WeightUnit): string {
  return `${value} ${unit}`;
}

// "Body weight over 12 weigh-ins, from 82.4 kg on 1 Sep to 80.9 kg on 29 Sep":
// the trend in words, for screen readers.
export function describeTrend({ unit, points }: BodyWeightTrend): string {
  const first = points[0];
  const last = points[points.length - 1];
  const weighIns = points.length === 1 ? '1 weigh-in' : `${points.length} weigh-ins`;
  const valueOn = (point: TrendPoint) =>
    `${formatBodyWeight(point.displayValue, unit)} on ${formatLocalDate(point.localDate)}`;
  return `Body weight over ${weighIns}, from ${valueOn(first)} to ${valueOn(last)}`;
}
