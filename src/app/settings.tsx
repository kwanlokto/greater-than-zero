import { useTheme } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { UnitPicker } from '@/components/unit-picker';
import type { WeightUnit } from '@/core/tracker';
import { tracker } from '@/database';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const [displayUnit, setDisplayUnit] = useState<WeightUnit>();

  useEffect(() => {
    tracker.getDisplayUnit().then(setDisplayUnit);
  }, []);

  async function changeDisplayUnit(unit: WeightUnit) {
    await tracker.setDisplayUnit(unit);
    setDisplayUnit(unit);
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.text }]}>Display unit</Text>
      <UnitPicker value={displayUnit} onChange={changeDisplayUnit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
  },
});
