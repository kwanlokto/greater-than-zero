# Greater Than Zero

## Development

- `npm test` runs the tracker core's tests against a fresh in-memory SQLite database.
- `npm run typecheck` type-checks the app and the core.
- `npm start` starts Metro for a development build on an Android device.

### Database changes

Edit `src/core/schema.ts`, then run `npm run db:generate` to add a migration to `drizzle/`. For data changes, `npx drizzle-kit generate --custom --name <name>` creates an empty SQL migration. The app applies migrations at launch. Restart Metro with `npx expo start --clear` so it picks up new SQL files.

### Builds

Builds run on EAS. Install its CLI with `npm install -g eas-cli` and sign in with `eas login`. `eas build --profile development --platform android` builds the development client and `eas build --profile preview --platform android` builds an installable APK.

To publish on Google Play, follow [Releasing on Google Play](docs/releasing-on-google-play.md).
