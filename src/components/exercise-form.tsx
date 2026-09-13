import { useTheme } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { OptionPicker } from '@/components/option-picker';
import { PrimaryButton } from '@/components/primary-button';
import { muscleGroups, trackingTypes, type NewExercise, type TrackingType } from '@/core/tracker';
import { muscleGroupLabels, trackingTypeLabels } from '@/exercise-labels';

type Props = {
  initial: Partial<NewExercise>;
  // Once an Exercise exists its tracking type can't change.
  trackingTypeFixed?: boolean;
  submitLabel: string;
  onSubmit: (values: NewExercise) => Promise<void>;
};

export function ExerciseForm({ initial, trackingTypeFixed = false, submitLabel, onSubmit }: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState(initial.name ?? '');
  const [trackingType, setTrackingType] = useState<TrackingType>(
    initial.trackingType ?? 'weighted',
  );
  const [muscleGroup, setMuscleGroup] = useState(initial.muscleGroup);

  const canSubmit = name.trim() !== '' && muscleGroup !== undefined;

  async function submit() {
    if (!canSubmit) return;
    await onSubmit({ name, trackingType, muscleGroup });
  }

  return (
    <View style={styles.form}>
      <Field label="Name">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Arnold Press"
          placeholderTextColor="#8e8e93"
          autoCapitalize="words"
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
          ]}
        />
      </Field>
      <Field label="Tracking type">
        {trackingTypeFixed ? (
          <Text style={[styles.fixed, { color: colors.text }]}>
            {trackingTypeLabels[trackingType]} (can't be changed)
          </Text>
        ) : (
          <OptionPicker
            options={trackingTypes}
            labels={trackingTypeLabels}
            value={trackingType}
            onChange={setTrackingType}
          />
        )}
      </Field>
      <Field label="Main muscle group">
        <View style={styles.chips}>
          {muscleGroups.map(group => (
            <Chip
              key={group}
              label={muscleGroupLabels[group]}
              selected={group === muscleGroup}
              onPress={() => setMuscleGroup(group)}
            />
          ))}
        </View>
      </Field>
      <PrimaryButton label={submitLabel} disabled={!canSubmit} onPress={submit} />
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 24,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  fixed: {
    fontSize: 16,
    opacity: 0.7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
