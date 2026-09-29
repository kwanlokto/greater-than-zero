import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { NameForm } from '@/components/name-form';
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

  async function create(name: string) {
    let id: string | undefined;
    const created = await runOrAlert(creation.failure, async () => {
      id = (await creation.run(name)).id;
    });
    if (created && id) router.replace({ pathname: '/templates/[id]', params: { id } });
  }

  return (
    <>
      <Stack.Screen options={{ title: creation.title }} />
      <NameForm placeholder="e.g. Push" submitLabel={creation.submitLabel} onSubmit={create} />
    </>
  );
}
