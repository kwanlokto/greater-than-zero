import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { restSecondsLeft } from '@/core/tracker';

const restChannelId = 'rest-timer';
// One notification at a time: scheduling it again replaces the last one.
const restNotificationId = 'rest-end';
const vibrationPattern = [0, 500, 250, 500];
// Device-local, so it lives in AsyncStorage rather than the database.
const permissionAskedKey = 'notificationPermissionAsked';

// Before any rest-end notification. It vibrates with no sound, which would
// play through headphones at the gym, and shows even while the app is open
// (e.g. on another tab). Android 8 and later take sound and vibration from the
// channel, which the app can't change once it's on a phone.
export async function setUpNotifications(): Promise<void> {
  try {
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
  } catch (error) {
    console.warn('Could not set up notifications', error);
  }
}

// Asked once, when the first Workout starts. Declining leaves the in-app timer
// working; only the notification is lost.
export async function askForNotificationsOnce(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(permissionAskedKey)) === 'true') return;
    await AsyncStorage.setItem(permissionAskedKey, 'true');
    await Notifications.requestPermissionsAsync();
  } catch (error) {
    console.warn('Could not ask for notifications', error);
  }
}

// Syncs run one after another, so quick ±15 s taps can't leave an older time
// scheduled.
let lastSync: Promise<void> = Promise.resolve();

// Keeps a single notification scheduled for the end of the current rest, or
// none when there's no rest ahead. Also clears one already shown, so logging
// the next Set tidies away "Rest over".
export function syncRestEndNotification(restEndsAt: Date | null): Promise<void> {
  lastSync = lastSync.then(async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(restNotificationId);
      await Notifications.dismissNotificationAsync(restNotificationId);
      if (!restEndsAt || restSecondsLeft(restEndsAt, new Date()) === 0) return;
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
          date: restEndsAt,
          channelId: restChannelId,
        },
      });
    } catch (error) {
      console.warn('Could not schedule the rest-end notification', error);
    }
  });
  return lastSync;
}
