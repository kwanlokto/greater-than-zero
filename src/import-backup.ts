import { File } from 'expo-file-system';
import { Alert } from 'react-native';

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
  if (!(await confirmReplacing(exportedAt))) return;
  await tracker.importBackup(contents);
  Alert.alert('Backup imported', 'Your data is back as it was in the backup.');
}

// True when the lifter chooses to replace their data. Dismissing it cancels.
function confirmReplacing(exportedAt: Date): Promise<boolean> {
  const from = formatLocalDateWithWeekday(localDateOf(exportedAt));
  return new Promise(resolve => {
    Alert.alert(
      'Replace all your data?',
      `This backup is from ${from}. Importing it replaces everything on this phone, ` +
        "including any workout in progress, and can't be undone.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Replace', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
