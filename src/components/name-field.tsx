import { useTheme } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { runOrAlert } from '@/run-or-alert';

type Props = {
  name: string;
  accessibilityLabel: string;
  failureTitle: string;
  rename: (name: string) => Promise<void>;
};

// A name, such as a Template's, saved when the lifter is done typing. A blank
// name is refused and put back.
export function NameField({ name: savedName, accessibilityLabel, failureTitle, rename }: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState(savedName);

  async function save() {
    if (name === savedName) return;
    if (!(await runOrAlert(failureTitle, () => rename(name)))) setName(savedName);
  }

  return (
    <TextInput
      value={name}
      onChangeText={setName}
      onEndEditing={save}
      autoCapitalize="words"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.input,
        { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '600',
  },
});
