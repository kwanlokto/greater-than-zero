import { Alert } from 'react-native';

export type Question = {
  title: string;
  message: string;
  // The button labels.
  decline: string;
  accept: string;
  // Shown as a warning, for accepting what can't be undone.
  destructive?: boolean;
};

// True when the lifter accepts. Dismissing it declines.
export function ask({ title, message, decline, accept, destructive }: Question): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      title,
      message,
      [
        { text: decline, style: 'cancel', onPress: () => resolve(false) },
        {
          text: accept,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

// Resolves once the lifter has dismissed it.
export function tell(title: string, message: string): Promise<void> {
  return new Promise(resolve => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}
