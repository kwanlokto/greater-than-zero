import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UnitPicker } from '@/components/unit-picker';
import { tracker } from '@/database';
import { useTrackerQuery } from '@/use-tracker-query';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={[styles.heading, { color: colors.text }]}>Display unit</Text>
        <UnitPicker value={displayUnit} onChange={unit => tracker.setDisplayUnit(unit)} />
      </View>
      <Link href="/exercises" asChild>
        <Pressable
          accessibilityRole="button"
          style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.linkLabel, { color: colors.text }]}>Exercise library</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  linkLabel: {
    fontSize: 16,
  },
});
