import type { ChartPoint } from '@/components/line-chart';
import { formatLocalDate } from '@/dates';

// "Body weight over 12 weigh-ins, from 82.4 kg on 1 Sep to 80.9 kg on 29 Sep":
// a chart in words, for screen readers. `counted` names one point and many.
export function describeChart(
  name: string,
  counted: { one: string; many: string },
  points: ChartPoint[],
): string {
  const first = points[0];
  const last = points[points.length - 1];
  const count = points.length === 1 ? `1 ${counted.one}` : `${points.length} ${counted.many}`;
  const labelOn = (point: ChartPoint) => `${point.label} on ${formatLocalDate(point.localDate)}`;
  return `${name} over ${count}, from ${labelOn(first)} to ${labelOn(last)}`;
}
