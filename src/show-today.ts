import type { ImperativeRouter } from 'expo-router';

// Closes every screen above the tabs and shows Today: where a Workout sits
// while it's in progress, and where the lifter lands when it ends.
export function showToday(router: Pick<ImperativeRouter, 'dismissAll' | 'navigate'>) {
  router.dismissAll();
  router.navigate('/');
}
