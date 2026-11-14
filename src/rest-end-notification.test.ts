import { createRestEndNotification, type Notifier } from './rest-end-notification';

const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

// A phone that keeps what it's been told: the one notification scheduled, if
// any, and whether permission was asked, which outlasts the app.
function fakePhone({ askedBefore = false } = {}) {
  const phone = {
    setUps: 0,
    asks: 0,
    asked: askedBefore,
    scheduled: null as Date | null,
    // How long each schedule takes, to make quick changes overlap.
    scheduleTakes: (_at: Date) => 0,
    failing: false,
  };
  const notifier: Notifier = {
    async setUp() {
      phone.setUps += 1;
    },
    async askPermission() {
      phone.asks += 1;
    },
    async hasAskedPermission() {
      return phone.asked;
    },
    async rememberAskedPermission() {
      phone.asked = true;
    },
    async schedule(at) {
      if (phone.setUps === 0) throw new Error('No channel to show it on');
      if (phone.failing) throw new Error('The phone said no');
      await pause(phone.scheduleTakes(at));
      phone.scheduled = at;
    },
    async clear() {
      phone.scheduled = null;
    },
  };
  return { phone, notifier };
}

describe('The rest-end notification', () => {
  let time: Date;
  const now = () => time;
  const inSeconds = (seconds: number) => new Date(time.getTime() + seconds * 1000);

  beforeEach(() => {
    time = new Date('2026-11-14T15:00:00Z');
  });

  it('is scheduled for the end of the rest', async () => {
    const { phone, notifier } = fakePhone();
    const notification = createRestEndNotification(notifier, now);

    await notification.follow({ restEndsAt: inSeconds(90) });

    expect(phone.scheduled).toEqual(inSeconds(90));
  });

  it('sets up its channel once, before anything is scheduled', async () => {
    const { phone, notifier } = fakePhone();
    const notification = createRestEndNotification(notifier, now);

    await notification.follow(null);
    await notification.follow({ restEndsAt: inSeconds(90) });
    await notification.follow({ restEndsAt: inSeconds(120) });

    expect(phone.setUps).toBe(1);
    expect(phone.scheduled).toEqual(inSeconds(120));
  });

  it('moves with the rest', async () => {
    const { phone, notifier } = fakePhone();
    const notification = createRestEndNotification(notifier, now);

    await notification.follow({ restEndsAt: inSeconds(90) });
    await notification.follow({ restEndsAt: inSeconds(105) });

    expect(phone.scheduled).toEqual(inSeconds(105));
  });

  it('goes when the rest ends early, and when the Workout is finished or discarded', async () => {
    const { phone, notifier } = fakePhone();
    const notification = createRestEndNotification(notifier, now);

    await notification.follow({ restEndsAt: inSeconds(90) });
    await notification.follow({ restEndsAt: null });
    expect(phone.scheduled).toBeNull();

    await notification.follow({ restEndsAt: inSeconds(90) });
    await notification.follow(null);
    expect(phone.scheduled).toBeNull();
  });

  it("isn't scheduled for a rest that's already over", async () => {
    const { phone, notifier } = fakePhone();
    const notification = createRestEndNotification(notifier, now);
    const restEndsAt = inSeconds(90);

    time = inSeconds(91);
    await notification.follow({ restEndsAt });

    expect(phone.scheduled).toBeNull();
  });

  it("handles quick changes in order, so an older rest end can't win", async () => {
    const { phone, notifier } = fakePhone();
    const notification = createRestEndNotification(notifier, now);
    const first = inSeconds(90);
    // The first takes longer to schedule than the second.
    phone.scheduleTakes = at => (at === first ? 20 : 0);

    const tapped = notification.follow({ restEndsAt: first });
    await notification.follow({ restEndsAt: inSeconds(105) });
    await tapped;

    expect(phone.scheduled).toEqual(inSeconds(105));
  });

  it('asks for permission when the first Workout starts, and never again', async () => {
    const { phone, notifier } = fakePhone();
    const notification = createRestEndNotification(notifier, now);

    await notification.follow(null);
    expect(phone.asks).toBe(0);

    await notification.follow({ restEndsAt: null });
    await notification.follow({ restEndsAt: inSeconds(90) });
    expect(phone.asks).toBe(1);

    // The app is opened again on the same phone.
    await createRestEndNotification(notifier, now).follow({ restEndsAt: null });
    expect(phone.asks).toBe(1);
  });

  it("doesn't ask on a phone where it asked before", async () => {
    const { phone, notifier } = fakePhone({ askedBefore: true });

    await createRestEndNotification(notifier, now).follow({ restEndsAt: null });

    expect(phone.asks).toBe(0);
  });

  it('carries on after the phone refuses one', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { phone, notifier } = fakePhone();
    const notification = createRestEndNotification(notifier, now);

    phone.failing = true;
    await notification.follow({ restEndsAt: inSeconds(90) });
    expect(phone.scheduled).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);

    phone.failing = false;
    await notification.follow({ restEndsAt: inSeconds(120) });
    expect(phone.scheduled).toEqual(inSeconds(120));
    warn.mockRestore();
  });
});
