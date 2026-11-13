import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Input } from '@/components/input';
import { formatWeight, problemWithWeighIn, type WeighIn, type WeightUnit } from '@/core/tracker';
import { formatTimeOfDay } from '@/dates';
import { parseDecimal } from '@/numbers';
import { space } from '@/theme';

type Props = {
  // Today's, or null before one is entered.
  weighIn: WeighIn | null;
  // The unit a weight is typed in.
  displayUnit: WeightUnit;
  // Resolves true once it's saved.
  onSave: (weight: number) => Promise<boolean>;
};

// Today's Weigh-in: what was entered, with a way to change it, or a box to
// enter one. A second one today replaces the first.
export function WeighInCard({ weighIn, displayUnit, onSave }: Props) {
  const [changing, setChanging] = useState(false);
  const [text, setText] = useState('');
  const typed = parseDecimal(text);
  // The core's own rule decides, so the box can't drift from it.
  const canSave = typed !== undefined && typed !== null && !problemWithWeighIn(typed);

  async function save() {
    if (!canSave || !(await onSave(typed))) return;
    setText('');
    setChanging(false);
  }

  if (weighIn && !changing) {
    return (
      <Card style={styles.recorded}>
        <View style={styles.reading}>
          <AppText variant="heading">{formatWeight(weighIn.displayWeight)}</AppText>
          <AppText variant="caption" tone="muted">
            at {formatTimeOfDay(weighIn.weighedAt)}
          </AppText>
        </View>
        <Button variant="tonal" size="small" label="Change" onPress={() => setChanging(true)} />
      </Card>
    );
  }

  return (
    <Card style={styles.compact}>
      <View style={styles.entry}>
        <Input
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          accessibilityLabel={`Body weight in ${displayUnit}`}
          placeholder={weighIn ? String(weighIn.displayWeight.value) : 'e.g. 82.4'}
          suffix={displayUnit}
          strong
          style={styles.input}
        />
        <Button
          label="Save"
          accessibilityLabel="Save weigh-in"
          disabled={!canSave}
          onPress={save}
          style={styles.save}
        />
      </View>
      {changing && <Button variant="ghost" label="Cancel" onPress={() => setChanging(false)} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  // One row: the weight and when, then Change.
  recorded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  reading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  compact: {
    paddingVertical: space.md,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  input: {
    flex: 1,
  },
  save: {
    minHeight: 52,
    paddingHorizontal: space.xl,
  },
});
