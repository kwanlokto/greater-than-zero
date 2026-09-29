import { File } from 'expo-file-system';

import { ask, tell } from '@/ask';
import { localDateOf } from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';

// Picks a Backup file with the system file picker, checks it, warns that
// importing replaces everything on this phone, and imports it once the lifter
// confirms. Throws, saying why, for a file that can't be imported, leaving the
// data as it was.
export async function importBackupFromFile() {
  const picked = await File.pickFileAsync();
  if (picked.canceled) return;
  const contents = await picked.result.text();
  const { exportedAt } = await tracker.checkBackup(contents);
  const replace = await ask({
    title: 'Replace all your data?',
    message:
      `This backup is from ${formatLocalDateWithWeekday(localDateOf(exportedAt))}. ` +
      "Importing it replaces everything on this phone, including any workout in progress, and can't be undone.",
    decline: 'Cancel',
    accept: 'Replace',
    destructive: true,
  });
  if (!replace) return;
  await tracker.importBackup(contents);
  await tell('Backup imported', 'Your data is back as it was in the backup.');
}
