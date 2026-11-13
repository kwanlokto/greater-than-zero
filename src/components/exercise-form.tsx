import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { OptionPicker } from '@/components/option-picker';
import { muscleGroups, trackingTypes, type NewExercise, type TrackingType } from '@/core/tracker';
import { muscleGroupLabels, trackingTypeLabels } from '@/exercise-labels';
import { space } from '@/theme';

type Props = {
  initial: Partial<NewExercise>;
  // Once an Exercise exists its tracking type can't change.
  trackingTypeFixed?: boolean;
  submitLabel: string;
  onSubmit: (values: NewExercise) => Promise<void>;
};

export function ExerciseForm({ initial, trackingTypeFixed = false, submitLabel, onSubmit }: Props) {
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
        <Input
          value={name}
          onChangeText={setName}
          placeholder="e.g. Arnold Press"
          autoCapitalize="words"
          strong
        />
      </Field>
      <Field
        label="Tracking type"
        hint={
          trackingTypeFixed
            ? "Can't be changed once the exercise exists."
            : 'Bodyweight exercises log any weight added, or taken off by a machine.'
        }
      >
        {trackingTypeFixed ? (
          <AppText variant="bodyStrong">{trackingTypeLabels[trackingType]}</AppText>
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
      <Button size="large" label={submitLabel} disabled={!canSubmit} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
