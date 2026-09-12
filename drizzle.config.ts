import type { Config } from 'drizzle-kit';

export default {
  schema: './src/core/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  // Also emits drizzle/migrations.js, which the app bundles and applies at launch.
  driver: 'expo',
} satisfies Config;
