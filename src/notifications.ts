import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const restChannelId = 'rest-timer';
// One notification at a time: scheduling it again replaces the last one.
const restNotificationId = 'rest-end';
// Device-local, so it lives in AsyncStorage rather than the database.
const permissionAskedKey = 'notificationPermissionAsked';

// Once at launch: rest-end notifications vibrate, and show even while the app
// is open (e.g. on another tab).
export async function setUpNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationChannelAsync(restChannelId, {
    name: 'Rest timer',
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true,
    vibrationPattern: [0, 500, 250, 500],
  });
}

// Asked once, when the first Workout starts. Declining leaves the in-app timer
// working; only the notification is lost.
export async function askForNotificationsOnce(): Promise<void> {
  if ((await AsyncStorage.getItem(permissionAskedKey)) === 'true') return;
  await AsyncStorage.setItem(permissionAskedKey, 'true');
  await Notifications.requestPermissionsAsync();
}

// Calls run one after another, so quick ±15 s taps can't leave an older time
// scheduled.
let pending: Promise<void> = Promise.resolve();

// Keeps a single notification scheduled for the end of the current rest, or
// none when there's no rest ahead. Also clears one already shown, so logging
// the next Set tidies away "Rest over".
export function scheduleRestEnd(restEndsAt: Date | null): Promise<void> {
  pending = pending
    .then(async () => {
      await Notifications.cancelScheduledNotificationAsync(restNotificationId);
      await Notifications.dismissNotificationAsync(restNotificationId);
      if (!restEndsAt || restEndsAt.getTime() <= Date.now()) return;
      await Notifications.scheduleNotificationAsync({
        identifier: restNotificationId,
        content: { title: 'Rest over', body: 'Time for your next set.' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: restEndsAt,
          channelId: restChannelId,
        },
      });
    })
    .catch(error => console.warn('Could not schedule the rest-end notification', error));
  return pending;
}
