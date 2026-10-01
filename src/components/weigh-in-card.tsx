import { useTheme } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { formatBodyWeight } from '@/body-weight-labels';
import { PrimaryButton } from '@/components/primary-button';
import { TextButton } from '@/components/text-button';
import { problemWithWeighIn, type WeighIn, type WeightUnit } from '@/core/tracker';
import { formatTimeOfDay } from '@/dates';
import { parseDecimal } from '@/numbers';

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
  const { colors } = useTheme();
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

  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];

  if (weighIn && !changing) {
    return (
      <View style={card}>
        <View style={styles.row}>
          <Text style={[styles.weight, { color: colors.text }]}>
            {formatBodyWeight(weighIn.displayWeight)}
          </Text>
          <Text style={[styles.details, { color: colors.text }]}>
            at {formatTimeOfDay(weighIn.weighedAt)}
          </Text>
        </View>
        <TextButton label="Change" onPress={() => setChanging(true)} />
      </View>
    );
  }

  return (
    <View style={card}>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          accessibilityLabel={`Body weight in ${displayUnit}`}
          placeholder={weighIn ? String(weighIn.displayWeight.value) : 'e.g. 82.4'}
          placeholderTextColor="#8e8e93"
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
          ]}
        />
        <Text style={[styles.details, { color: colors.text }]}>{displayUnit}</Text>
      </View>
      <PrimaryButton label="Save weigh-in" disabled={!canSave} onPress={save} />
      {changing && <TextButton label="Cancel" onPress={() => setChanging(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  weight: {
    fontSize: 24,
    fontWeight: '600',
  },
  details: {
    fontSize: 16,
    opacity: 0.7,
  },
  input: {
    width: 100,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'right',
  },
});
