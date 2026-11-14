import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import type { Notifier } from '@/rest-end-notification';

const restChannelId = 'rest-timer';
const restNotificationId = 'rest-end';
const vibrationPattern = [0, 500, 250, 500];
// Device-local, so it lives in AsyncStorage rather than the database.
const permissionAskedKey = 'notificationPermissionAsked';

// The rest-end notification on the phone, through expo-notifications.
export const phoneNotifier: Notifier = {
  // It vibrates with no sound, which would play through headphones at the
  // gym, and shows even while the app is open (e.g. on another tab). Android 8
  // and later take sound and vibration from the channel, which the app can't
  // change once it's on a phone.
  async setUp() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        // Also needed to vibrate: without it, expo silences the notification.
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    await Notifications.setNotificationChannelAsync(restChannelId, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      enableVibrate: true,
      vibrationPattern,
    });
  },

  async askPermission() {
    await Notifications.requestPermissionsAsync();
  },

  async hasAskedPermission() {
    return (await AsyncStorage.getItem(permissionAskedKey)) === 'true';
  },

  async rememberAskedPermission() {
    await AsyncStorage.setItem(permissionAskedKey, 'true');
  },

  // The same identifier every time, so scheduling again replaces it.
  async schedule(at: Date) {
    await Notifications.scheduleNotificationAsync({
      identifier: restNotificationId,
      content: {
        title: 'Rest over',
        body: 'Time for your next set.',
        // Android 7 has no channels, so it takes the vibration from here.
        vibrate: vibrationPattern,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: restChannelId,
      },
    });
  },

  async clear() {
    await Notifications.cancelScheduledNotificationAsync(restNotificationId);
    await Notifications.dismissNotificationAsync(restNotificationId);
  },
};
