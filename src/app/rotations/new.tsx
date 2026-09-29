import { useRouter } from 'expo-router';

import { NameForm } from '@/components/name-form';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';

// Names a new Rotation, then opens it to add Templates.
export default function NewRotationScreen() {
  const router = useRouter();

  async function create(name: string) {
    let id: string | undefined;
    const created = await runOrAlert("Couldn't create the rotation", async () => {
      id = (await tracker.createRotation(name)).id;
    });
    if (created && id) router.replace({ pathname: '/rotations/[id]', params: { id } });
  }

  return <NameForm placeholder="e.g. PPL" submitLabel="Create rotation" onSubmit={create} />;
}
