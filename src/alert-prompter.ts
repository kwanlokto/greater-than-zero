import { Alert } from 'react-native';

import type { Prompter } from '@/prompter';

// The prompter on the phone: Android's alert dialog. Tapping outside a
// question declines it.
export const alertPrompter: Prompter = {
  ask({ title, message, decline, accept, destructive }) {
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
  },

  tell(title, message) {
    return new Promise(resolve => {
      Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }], {
        cancelable: true,
        onDismiss: () => resolve(),
      });
    });
  },
};
