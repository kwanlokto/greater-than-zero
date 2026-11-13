import { File } from 'expo-file-system';

import { alertPrompter } from '@/alert-prompter';
import { tracker } from '@/database';
import { importBackup } from '@/import-backup';

// Picks a Backup file with the system file picker and imports it, once the
// lifter confirms (see importBackup).
export async function importBackupFromFile() {
  const picked = await File.pickFileAsync();
  if (picked.canceled) return;
  await importBackup(tracker, alertPrompter, await picked.result.text());
}
