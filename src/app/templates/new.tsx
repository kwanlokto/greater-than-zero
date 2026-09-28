import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';

// What naming the new Template does: create an empty one to add Exercises to,
// or save a finished Workout (fromWorkoutId) as one, holding its Exercises with
// Targets taken from what was done.
function creationFor(fromWorkoutId: string | undefined) {
  if (fromWorkoutId) {
    return {
      title: 'Save as template',
      submitLabel: 'Save template',
      failure: "Couldn't save the workout as a template",
      run: (name: string) => tracker.saveWorkoutAsTemplate(fromWorkoutId, name),
    };
  }
  return {
    title: 'New template',
    submitLabel: 'Create template',
    failure: "Couldn't create the template",
    run: (name: string) => tracker.createTemplate(name),
  };
}

// Names a new Template, then opens it.
export default function NewTemplateScreen() {
  const creation = creationFor(useLocalSearchParams<{ fromWorkoutId?: string }>().fromWorkoutId);
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState('');

  async function create() {
    let id: string | undefined;
    const created = await runOrAlert(creation.failure, async () => {
      id = (await creation.run(name)).id;
    });
    if (created && id) router.replace({ pathname: '/templates/[id]', params: { id } });
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: creation.title }} />
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Push"
          placeholderTextColor="#8e8e93"
          autoCapitalize="words"
          autoFocus
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
          ]}
        />
      </View>
      <PrimaryButton label={creation.submitLabel} disabled={name.trim() === ''} onPress={create} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 24,
  },
  field: {
    gap: 8,
  },
  label: {
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
});
