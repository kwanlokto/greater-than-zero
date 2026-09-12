# Greater Than Zero

## Development

- `npm test` runs the tracker core's tests against a fresh in-memory SQLite database.
- `npm run typecheck` type-checks the app and the core.
- `npm start` starts Metro for a development build on an Android device.

### Database changes

Edit `src/core/schema.ts`, then run `npm run db:generate` to add a migration to `drizzle/`. For data changes, `npx drizzle-kit generate --custom --name <name>` creates an empty SQL migration. The app applies migrations at launch. Restart Metro with `npx expo start --clear` so it picks up new SQL files.

### Builds

Builds run on EAS. `eas build --profile development` builds the development client and `eas build --profile preview` builds an installable APK.
