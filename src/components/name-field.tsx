import { useState } from 'react';

import { Field } from '@/components/field';
import { Input } from '@/components/input';
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
  const [name, setName] = useState(savedName);

  async function save() {
    if (name === savedName) return;
    if (!(await runOrAlert(failureTitle, () => rename(name)))) setName(savedName);
  }

  return (
    <Field label="Name" hint="Saved when you're done typing">
      <Input
        value={name}
        onChangeText={setName}
        onEndEditing={save}
        autoCapitalize="words"
        returnKeyType="done"
        accessibilityLabel={accessibilityLabel}
        strong
      />
    </Field>
  );
}
