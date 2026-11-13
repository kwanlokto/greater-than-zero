import { useState } from 'react';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { Screen } from '@/components/screen';
import { useGuardedPress } from '@/use-guarded-press';

type Props = {
  // An example name, e.g. "e.g. Push".
  placeholder: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
};

// Asks for the name of something new, such as a Template.
export function NameForm({ placeholder, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState('');
  const canSubmit = name.trim() !== '';
  // Shared by the button and the keyboard's Done key, so a tap on each, or a
  // double tap, creates one.
  const { press: submit } = useGuardedPress(async () => {
    if (canSubmit) await onSubmit(name);
  });

  return (
    <Screen>
      <Field label="Name">
        <Input
          value={name}
          onChangeText={setName}
          placeholder={placeholder}
          autoCapitalize="words"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          strong
        />
      </Field>
      <Button size="large" label={submitLabel} disabled={!canSubmit} onPress={submit} />
    </Screen>
  );
}
