import { Alert } from 'react-native';

// Runs a core command, telling the lifter why if it's refused. True if it ran.
export async function runOrAlert(
  failureTitle: string,
  command: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await command();
    return true;
  } catch (error) {
    Alert.alert(failureTitle, error instanceof Error ? error.message : String(error));
    return false;
  }
}
