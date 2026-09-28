import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';

// Names a new Template, then opens it. It starts empty for adding Exercises,
// or, when saving a finished Workout as a Template (fromWorkoutId), holds that
// Workout's Exercises with Targets taken from what was done.
export default function NewTemplateScreen() {
  const { fromWorkoutId } = useLocalSearchParams<{ fromWorkoutId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState('');

  async function create() {
    let id: string | undefined;
    const created = await runOrAlert("Couldn't create the template", async () => {
      const template = fromWorkoutId
        ? await tracker.saveWorkoutAsTemplate(fromWorkoutId, name)
        : await tracker.createTemplate(name);
      id = template.id;
    });
    if (created && id) router.replace({ pathname: '/templates/[id]', params: { id } });
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {fromWorkoutId && <Stack.Screen options={{ title: 'Save as template' }} />}
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
      <PrimaryButton
        label={fromWorkoutId ? 'Save template' : 'Create template'}
        disabled={name.trim() === ''}
        onPress={create}
      />
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
