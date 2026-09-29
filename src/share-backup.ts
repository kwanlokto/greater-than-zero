import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { localDateOf } from '@/core/tracker';
import { tracker } from '@/database';

// Exports the Backup file and hands it to the Android share menu, to keep in
// Drive, send by email or save anywhere else. Named for today, e.g.
// greater-than-zero-backup-2026-09-29.json; a second export that day replaces
// the first in the app's cache.
export async function shareBackup() {
  const contents = await tracker.exportBackup(Constants.expoConfig?.version ?? 'unknown');
  const file = new File(Paths.cache, `greater-than-zero-backup-${localDateOf(new Date())}.json`);
  file.write(contents);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your backup',
  });
}
