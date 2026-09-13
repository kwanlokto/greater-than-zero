import { createTestDatabase } from './test-database';
import { names } from './test-helpers';
import { createTracker } from './tracker';

describe('Exercise library', () => {
  it('finds Exercises whose name contains the search, ignoring case', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ query: 'BENCH' });

    expect(names(found)).toEqual([
      'Bench Press',
      'Close-Grip Bench Press',
      'Dumbbell Bench Press',
      'Incline Bench Press',
    ]);
  });

  it('matches every word of the search, in any order', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ query: 'press incline' });

    expect(names(found)).toEqual(['Incline Bench Press', 'Incline Dumbbell Press']);
  });

  it('ignores hyphens, so a search for "pullup" finds Pull-up', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ query: 'pullup' });

    expect(names(found)).toEqual(['Pull-up']);
  });

  it('filters by main muscle group', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ muscleGroup: 'hamstrings' });

    expect(names(found)).toEqual(['Leg Curl', 'Romanian Deadlift']);
  });

  it('applies the search and the muscle-group filter together', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ query: 'curl', muscleGroup: 'biceps' });

    expect(names(found)).toEqual(['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl']);
  });

  it('lists the whole library in name order when the search is blank and no filter is set', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ query: '  ' });

    expect(found).toHaveLength(41);
    expect(names(found).slice(0, 3)).toEqual(['Ab Wheel Rollout', 'Barbell Curl', 'Barbell Row']);
  });

  it('describes each built-in Exercise by its name, tracking type and main muscle group', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ query: 'pull-up' });

    expect(found).toEqual([
      {
        id: expect.any(String),
        name: 'Pull-up',
        trackingType: 'bodyweight',
        muscleGroup: 'back',
        isCustom: false,
      },
    ]);
  });

  it('gives every built-in Exercise the same ID on every install', async () => {
    const firstInstall = createTracker(createTestDatabase());
    const secondInstall = createTracker(createTestDatabase());

    expect(await secondInstall.searchExercises({})).toEqual(await firstInstall.searchExercises({}));
  });

  it('keeps every built-in Exercise ID from one app version to the next', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({});
    const namesById = Object.fromEntries(found.map(exercise => [exercise.id, exercise.name]));

    // New built-ins may be added, but a published ID must never change,
    // disappear or move to another Exercise.
    expect(namesById).toMatchObject(publishedBuiltInIds);
  });
});

// Backup files and other installs refer to these IDs.
const publishedBuiltInIds = {
  '727a98e3-704c-4027-8be1-9a2b89dec956': 'Bench Press',
  '0fc984d5-db98-4cba-a45d-c65de3e3b8bf': 'Incline Bench Press',
  'f6a91dc7-3ba7-4ffc-b0cb-b0a4e5e16f0a': 'Dumbbell Bench Press',
  '1c41f818-b913-46a7-bc08-bcfe9edd1203': 'Incline Dumbbell Press',
  '2c65fe43-51da-4de5-8960-6433ade047ce': 'Cable Fly',
  '9b64d858-5ede-49b5-a092-587e985db5cd': 'Push-up',
  'fe8564c4-a305-4c9c-9f5a-8fb9456cca40': 'Deadlift',
  '3e64cdc6-d256-41a7-ba6d-f6853e5eca51': 'Pull-up',
  'c8cb7964-936d-402d-b543-dd3c32e43794': 'Chin-up',
  '29e0195d-b271-438f-9fb1-e308ac5bb9b0': 'Lat Pulldown',
  '46f95540-06fc-47db-8fd0-9a35251200a4': 'Barbell Row',
  '6951f7a9-5277-495b-9bab-4b0d827ce44b': 'Dumbbell Row',
  'ffcb3fa2-485d-420b-81bc-8a3ffbc63fe9': 'Seated Cable Row',
  '02587bcf-2f10-4630-a4b4-76e9e0a7fb19': 'Overhead Press',
  '060d9a1d-6403-44a1-9cf2-7b9639891e76': 'Dumbbell Shoulder Press',
  '579e4af6-8730-456a-ab75-e65f9cc32197': 'Lateral Raise',
  'a3a3fc99-8308-48be-912c-6c8c097c537c': 'Reverse Fly',
  'daf7670b-312c-49e7-92df-0a1af2507707': 'Face Pull',
  '7636c207-4f0a-4f08-8567-68b4c66732dd': 'Barbell Curl',
  '11cc9014-bb82-47bc-96b0-98b5c8dfda2f': 'Dumbbell Curl',
  '1960e621-15a1-49ab-833d-31031fc83af0': 'Hammer Curl',
  '21a7959b-dc67-4f51-ab5d-4733eacd8aff': 'Preacher Curl',
  'c820fda4-0db9-45dd-918a-f29225f097d3': 'Close-Grip Bench Press',
  'ee128a8c-0acc-4bfc-9bfd-4fbab5d53ee4': 'Dip',
  '5844b939-43a7-41f0-b881-18f905658c85': 'Triceps Pushdown',
  'f772463e-6773-4412-aeb0-cbcdf7bb78ec': 'Skull Crusher',
  '3ab84d50-68cb-4c4f-a70d-d388cb693058': 'Overhead Triceps Extension',
  '3f378344-eb51-4547-b5e2-879c89077aa7': 'Squat',
  'a899343a-61c3-4779-8911-3a0ec825f772': 'Front Squat',
  '9052c3a0-67eb-4567-8e2c-21faf8ac23bb': 'Leg Press',
  '57a07f28-5670-4fe4-a14a-67405acce342': 'Leg Extension',
  '1a99ce9a-4a5d-4ab0-b988-10962cd527ee': 'Bulgarian Split Squat',
  '922305ff-eba4-419b-8938-099a70df54fa': 'Lunge',
  '875519be-a22d-46dc-abb5-7233b4789282': 'Romanian Deadlift',
  '275df01c-d10d-4903-bf33-60d0efae60c6': 'Leg Curl',
  'bcd6b4fa-ef5c-4ca6-8374-65ba6e2b12d5': 'Hip Thrust',
  'ddc1708e-6866-4afc-87ed-92af5669da36': 'Standing Calf Raise',
  '8ddd9a06-210e-41ff-90a9-d730df1709e2': 'Seated Calf Raise',
  '228f7f68-3ea4-4275-a79b-75efac38f8ee': 'Hanging Leg Raise',
  '4887d8f8-1f2a-4f28-bb65-2b5c0a834b5b': 'Cable Crunch',
  'd72fc32a-8193-45b4-833b-8670b8ee4ec8': 'Ab Wheel Rollout',
};
