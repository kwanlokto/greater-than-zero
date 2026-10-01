import { useTheme } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { dayNumberOf, formatLocalDate } from '@/dates';

// A value on a local date, as YYYY-MM-DD, and how it reads, e.g. "116.7 kg".
export type ChartPoint = { localDate: string; value: number; label: string };

type Props = {
  // In order. Points on the same date sit side by side.
  points: ChartPoint[];
  // Ticks on the value axis are whole numbers, e.g. for reps.
  wholeNumbers?: boolean;
  // What the chart shows, for screen readers; the screen lists the values too.
  description: string;
};

const height = 200;
const margin = { top: 12, right: 12, bottom: 24, left: 40 };
// Past this many points, only the selected one gets a marker.
const maxMarkedPoints = 40;

// One series over time: a 2px line with a faint wash under it, hairline
// gridlines at clean values, and the first and last dates. The readout above
// leads with the latest point's value and date; touching the chart moves a
// crosshair to the nearest point and reads that one out instead.
export function LineChart({ points, wholeNumbers = false, description }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [touchedIndex, setTouchedIndex] = useState<number>();

  if (points.length === 0) return null;
  const touched = touchedIndex !== undefined && touchedIndex < points.length;
  const selected = touched ? touchedIndex : points.length - 1;
  const days = dayPositions(points);
  const ticks = niceTicks(
    Math.min(...points.map(point => point.value)),
    Math.max(...points.map(point => point.value)),
    wholeNumbers,
  );
  const plotWidth = Math.max(0, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const [firstDay, lastDay] = [days[0], days[days.length - 1]];
  const xOf = (day: number) =>
    margin.left +
    (lastDay === firstDay ? plotWidth / 2 : ((day - firstDay) / (lastDay - firstDay)) * plotWidth);
  const [low, high] = [ticks[0], ticks[ticks.length - 1]];
  const yOf = (value: number) =>
    margin.top + plotHeight - ((value - low) / (high - low)) * plotHeight;
  const xs = days.map(xOf);
  const ys = points.map(point => yOf(point.value));
  const line = xs.map((x, index) => `${index === 0 ? 'M' : 'L'}${x},${ys[index]}`).join(' ');
  const baseline = margin.top + plotHeight;
  const wash = `${line} L${xs[xs.length - 1]},${baseline} L${xs[0]},${baseline} Z`;
  const markers = points.length <= maxMarkedPoints ? points.map((_, index) => index) : [selected];

  // The nearest point to where the chart is touched.
  const touch = (event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX;
    let nearest = 0;
    xs.forEach((pointX, index) => {
      if (Math.abs(pointX - x) < Math.abs(xs[nearest] - x)) nearest = index;
    });
    setTouchedIndex(nearest);
  };

  return (
    <View style={styles.chart}>
      <View style={styles.readout}>
        <Text style={[styles.value, { color: colors.text }]}>{points[selected].label}</Text>
        <Text style={[styles.date, { color: colors.text }]}>
          {formatLocalDate(points[selected].localDate)}
        </Text>
      </View>
      <View
        accessible
        accessibilityLabel={description}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={touch}
        onResponderMove={touch}
        style={{ height }}
      >
        {width > 0 && (
          <Svg width={width} height={height}>
            {ticks.map(tick => (
              <Line
                key={`grid-${tick}`}
                x1={margin.left}
                x2={width - margin.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {ticks.map(tick => (
              <SvgText
                key={`tick-${tick}`}
                x={margin.left - 6}
                y={yOf(tick) + 4}
                fontSize={11}
                textAnchor="end"
                fill={colors.text}
                opacity={0.6}
              >
                {String(tick)}
              </SvgText>
            ))}
            <Path d={wash} fill={colors.primary} opacity={0.1} />
            <Path
              d={line}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {touched && (
              <Line
                x1={xs[selected]}
                x2={xs[selected]}
                y1={margin.top}
                y2={baseline}
                stroke={colors.text}
                strokeWidth={1}
                opacity={0.3}
              />
            )}
            {markers.map(index => (
              <Circle
                key={index}
                cx={xs[index]}
                cy={ys[index]}
                r={index === selected ? 6 : 4}
                fill={colors.primary}
                stroke={colors.card}
                strokeWidth={2}
              />
            ))}
            <SvgText
              x={points.length === 1 ? xs[0] : margin.left}
              y={height - 6}
              fontSize={11}
              textAnchor={points.length === 1 ? 'middle' : 'start'}
              fill={colors.text}
              opacity={0.6}
            >
              {formatLocalDate(points[0].localDate)}
            </SvgText>
            {points.length > 1 && (
              <SvgText
                x={width - margin.right}
                y={height - 6}
                fontSize={11}
                textAnchor="end"
                fill={colors.text}
                opacity={0.6}
              >
                {formatLocalDate(points[points.length - 1].localDate)}
              </SvgText>
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}

// Where each point sits along the time axis, in days. Points on the same date
// share the day, spread across part of it in their order.
function dayPositions(points: ChartPoint[]): number[] {
  const onDate = new Map<string, number>();
  for (const { localDate } of points) onDate.set(localDate, (onDate.get(localDate) ?? 0) + 1);
  const seen = new Map<string, number>();
  return points.map(({ localDate }) => {
    const nth = seen.get(localDate) ?? 0;
    seen.set(localDate, nth + 1);
    return dayNumberOf(localDate) + (nth / (onDate.get(localDate) ?? 1)) * 0.6;
  });
}

// Clean values for the value axis, about four of them, spanning low to high in
// steps of 1, 2 or 5 times a power of ten.
function niceTicks(low: number, high: number, wholeNumbers: boolean): number[] {
  if (low === high) {
    const spread = Math.abs(low) * 0.1 || 1;
    [low, high] = [low - spread, high + spread];
  }
  const rough = (high - low) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  let step = [1, 2, 5, 10].map(multiple => multiple * power).find(each => each >= rough) ?? rough;
  if (wholeNumbers) step = Math.max(1, Math.round(step));
  const first = Math.floor(low / step) * step;
  const ticks = [];
  for (let tick = first; tick < high + step; tick += step) {
    // Rounded so steps like 0.1 don't drift to 0.30000000000000004.
    ticks.push(Math.round(tick * 1e6) / 1e6);
    if (tick >= high) break;
  }
  return ticks;
}

const styles = StyleSheet.create({
  chart: {
    gap: 8,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: '600',
  },
  date: {
    fontSize: 14,
    opacity: 0.6,
  },
});
