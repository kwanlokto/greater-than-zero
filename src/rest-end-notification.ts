// The notification that says a rest is over, kept in step with the Workout in
// progress. It reaches the phone through a Notifier: phone-notifier.ts on the
// phone, a fake in the tests.

import { restSecondsLeft } from '@/core/tracker';

// What the phone does for the rest-end notification.
export type Notifier = {
  // The channel the notification shows on, needed before scheduling it.
  setUp(): Promise<void>;
  askPermission(): Promise<void>;
  // Whether permission was asked on this phone before, even in an earlier
  // launch.
  hasAskedPermission(): Promise<boolean>;
  rememberAskedPermission(): Promise<void>;
  // There's only ever one notification: scheduling it again replaces it.
  schedule(at: Date): Promise<void>;
  // Cancels it, and takes it away if it's already showing, so logging the
  // next Set tidies away "Rest over".
  clear(): Promise<void>;
};

// The Workout in progress as far as the notification goes: when its rest
// ends, null with no rest running.
export type WorkoutResting = { restEndsAt: Date | null };

export type RestEndNotification = ReturnType<typeof createRestEndNotification>;

export function createRestEndNotification(notifier: Notifier, now: () => Date = () => new Date()) {
  let settingUp: Promise<void> | undefined;
  let asking: Promise<void> | undefined;
  let syncs: Promise<void> = Promise.resolve();

  function setUpOnce() {
    settingUp ??= attempt('set up notifications', () => notifier.setUp());
    return settingUp;
  }

  // Declining leaves the in-app timer working; only the notification is lost.
  function askOnce() {
    asking ??= attempt('ask for notifications', async () => {
      if (await notifier.hasAskedPermission()) return;
      await notifier.rememberAskedPermission();
      await notifier.askPermission();
    });
    return asking;
  }

  async function sync(restEndsAt: Date | null) {
    await setUpOnce();
    await attempt('schedule the rest-end notification', async () => {
      await notifier.clear();
      if (restEndsAt && restSecondsLeft(restEndsAt, now()) > 0) await notifier.schedule(restEndsAt);
    });
  }

  return {
    // Called with the Workout in progress, or null with none, whenever it
    // changes. Permission is asked when the first Workout ever starts. One
    // notification stays scheduled for the end of its rest, moved with it,
    // and none once the rest is over or the Workout is finished or
    // discarded. Changes are handled one at a time, so quick ±15 s taps
    // can't leave an older time scheduled. Resolves once it's all done;
    // nothing it does is refused, as a failure is only logged.
    follow(workout: WorkoutResting | null): Promise<void> {
      const asked = workout ? askOnce() : undefined;
      syncs = syncs.then(() => sync(workout?.restEndsAt ?? null));
      return Promise.all([asked, syncs]).then(() => undefined);
    },
  };
}

async function attempt(what: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.warn(`Could not ${what}`, error);
  }
}
