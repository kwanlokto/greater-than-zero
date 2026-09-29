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
import m0008 from './0008_add_rest_timer.sql';
import m0009 from './0009_add_workouts_is_backfilled.sql';
import m0010 from './0010_create_templates.sql';
import m0011 from './0011_start_workouts_from_templates.sql';
import m0012 from './0012_link_entries_to_template_exercises.sql';
import m0013 from './0013_create_rotations.sql';
import m0014 from './0014_create_meals.sql';

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
m0007,
m0008,
m0009,
m0010,
m0011,
m0012,
m0013,
m0014
    }
  }
  