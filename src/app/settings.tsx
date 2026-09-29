import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useTheme, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { UnitPicker } from '@/components/unit-picker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { shareBackup } from '@/share-backup';
import { useTrackerQuery } from '@/use-tracker-query';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={[styles.heading, { color: colors.text }]}>Display unit</Text>
        <UnitPicker value={displayUnit} onChange={unit => tracker.setDisplayUnit(unit)} />
      </View>
      <LinkRow href="/templates" label="Templates" />
      <LinkRow href="/rotations" label="Rotations" />
      <LinkRow href="/exercises" label="Exercise library" />
      <View style={styles.section}>
        <Text style={[styles.heading, { color: colors.text }]}>Backup</Text>
        <Text style={[styles.details, { color: colors.text }]}>
          Save all your data to a file you can keep in Drive or send by email.
        </Text>
        <PrimaryButton
          label="Export backup"
          onPress={async () => {
            await runOrAlert("Couldn't export the backup", shareBackup);
          }}
        />
      </View>
    </ScrollView>
  );
}

function LinkRow({ href, label }: { href: Href; label: string }) {
  const { colors } = useTheme();

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.linkLabel, { color: colors.text }]}>{label}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      </Pressable>
    </Link>
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
  details: {
    fontSize: 14,
    opacity: 0.7,
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
