import { localDateOf, type Tracker } from '@/core/tracker';
import { formatLocalDateWithWeekday } from '@/dates';
import type { Prompter } from '@/prompter';

// Imports a Backup file's contents once the lifter confirms, after checking it
// and warning that importing replaces everything on this phone. Throws, saying
// why, for a file that can't be imported, leaving the data as it was. True if
// it was imported.
export async function importBackup(
  tracker: Tracker,
  prompter: Prompter,
  contents: string,
): Promise<boolean> {
  const { exportedAt } = await tracker.checkBackup(contents);
  const replace = await prompter.ask({
    title: 'Replace all your data?',
    message:
      `This backup is from ${formatLocalDateWithWeekday(localDateOf(exportedAt))}. ` +
      "Importing it replaces everything on this phone, including any workout in progress, and can't be undone.",
    decline: 'Cancel',
    accept: 'Replace',
    destructive: true,
  });
  if (!replace) return false;
  await tracker.importBackup(contents);
  await prompter.tell('Backup imported', 'Your data is back as it was in the backup.');
  return true;
}
