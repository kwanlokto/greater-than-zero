import journal from './meta/_journal.json';
import m0000 from './0000_create_settings.sql';
import m0001 from './0001_insert_settings_row.sql';
import m0002 from './0002_create_exercises.sql';
import m0003 from './0003_insert_built_in_exercises.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003
    }
  }
  