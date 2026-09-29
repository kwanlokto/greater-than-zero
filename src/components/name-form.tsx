import { useTheme } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';

type Props = {
  // An example name, e.g. "e.g. Push".
  placeholder: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
};

// Asks for the name of something new, such as a Template.
export function NameForm({ placeholder, submitLabel, onSubmit }: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={placeholder}
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
        label={submitLabel}
        disabled={name.trim() === ''}
        onPress={() => onSubmit(name)}
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
