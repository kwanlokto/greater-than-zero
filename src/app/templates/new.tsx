import { useRouter, useTheme } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';

// Names a new Template, then opens it to add its Exercises.
export default function NewTemplateScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState('');

  async function create() {
    let id: string | undefined;
    const created = await runOrAlert("Couldn't create the template", async () => {
      id = (await tracker.createTemplate(name)).id;
    });
    if (created && id) router.replace({ pathname: '/templates/[id]', params: { id } });
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
      <PrimaryButton label="Create template" disabled={name.trim() === ''} onPress={create} />
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
