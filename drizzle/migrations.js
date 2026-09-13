// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_create_settings.sql';
import m0001 from './0001_insert_settings_row.sql';
import m0002 from './0002_create_exercises.sql';
import m0003 from './0003_insert_built_in_exercises.sql';
import m0004 from './0004_add_exercises_is_custom.sql';
import m0005 from './0005_create_workouts.sql';
import m0006 from './0006_add_sets_is_warm_up.sql';
import m0007 from './0007_add_exercise_entries_notes.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007
    }
  }
  