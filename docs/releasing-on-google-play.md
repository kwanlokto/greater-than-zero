# Releasing on Google Play

This is how to take Notch from EAS builds that friends install to a public Google Play listing. The first release takes three to four weeks, mostly because a new personal developer account must run a 14-day closed test before Google allows a production release. After that, an update is a build, an upload and Google's review.

It follows the "Play Store prerequisites" in spec #1: the closed test, the EAS signing key in Play App Signing, and a privacy policy and Data safety form.

## Before the first release

### Decide on exact alarms

`app.json` declares `SCHEDULE_EXACT_ALARM` and `USE_EXACT_ALARM` so the rest-end notification arrives on time. Google Play treats `USE_EXACT_ALARM` as a restricted permission. An app may declare it only if its core, user-facing purpose needs exact alarms, as an alarm, timer or calendar app does. Play reviews that claim, and an app that doesn't qualify can't be published. A rest timer in a workout tracker is a borderline case.

Pick one of these before the first release:

- **Keep `USE_EXACT_ALARM`** and fill in Play Console's exact alarm declaration, describing the rest timer. Notifications stay exact for everyone, but review may reject the app.
- **Drop `USE_EXACT_ALARM` and keep `SCHEDULE_EXACT_ALARM`.** Remove it from `android.permissions`, and list it under `android.blockedPermissions` so no library adds it back. Android 14 and later deny `SCHEDULE_EXACT_ALARM` until the user allows "Alarms & reminders" for the app, so the app needs code that asks for it. Until a user allows it, their notification can arrive a minute or more late.
- **Drop both.** No code changes, but the notification can be late on every phone.

The in-app rest timer stays exact whichever you choose, because it counts down from the rest end time. Only the notification is affected.

### Add an app icon

`app.json` has no `icon` or `android.adaptiveIcon` yet, so builds show a default icon. You need three images:

- A 1024×1024 PNG for `expo.icon`.
- An adaptive icon: `android.adaptiveIcon.foregroundImage` (a 1024×1024 PNG with the artwork centred on a transparent background) and `android.adaptiveIcon.backgroundColor`. Expo's [app icon guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) covers the safe area.
- A 512×512 PNG of the icon for the store listing.

The icon is built into the app, so it ships with the next build.

### Write a privacy policy

Play wants a privacy policy link from every app, even one that collects no data. It must be at a public web address, not a PDF. This repository is public, so a Markdown file here or a GitHub Pages page will do. For v1 it should say:

- Everything you log stays in a database on your phone. There are no accounts, and the app sends nothing to the developer or anyone else.
- Android Auto Backup may copy the app's data to your Google account, under Google's terms.
- A Backup file is made only when you export one, and goes wherever you send it.
- The only notification is the rest-end alert, which the phone schedules.
- There are no ads, analytics or tracking.
- How to contact you, and when the policy last changed.

## 1. Create the developer account

Sign up at [play.google.com/console/signup](https://play.google.com/console/signup) with a personal account. It costs a one-time US$25 and includes identity verification. Google may also ask you to confirm through the Play Console app that you have an Android phone.

Personal accounts created after 13 November 2023 must run a closed test before they can release to production (step 7).

## 2. Create the app

In Play Console, choose **Create app** and fill it in:

- **App name:** Notch
- **App or game:** App
- **Free or paid:** Free. A free app can never become paid.

Then accept the declarations. You don't choose the package name here. The first upload sets it to `com.rkwan.greater_than_zero`, permanently.

## 3. Give Play the EAS signing key

Friends' installs are signed with the key EAS generated for this app. If Play signs its builds with that same key, a friend's install updates from Play in place and keeps its data. Spec #1 chose this.

Change the key before anyone installs from Play. Play lets you change the app signing key only until a release reaches open testing or production. Anyone who installs a Play build signed with a different key would have to uninstall it, and lose their data, once the key changes.

1. Download the key. Run `eas credentials --platform android`, choose the `production` profile, then **credentials.json: Upload/Download credentials between EAS servers and your local json**, then **Download credentials from EAS to credentials.json**. You get `credentials.json`, with the keystore path, passwords and `keyAlias`, and the keystore file.
2. In Play Console, open the app and go to **Protected with Play → Play Store protection → Manage Play app signing → Change key**. Choose to provide a copy of your app signing key and follow its steps: download the PEPK tool and Google's encryption key, run the command shown against your keystore and `keyAlias`, and upload the encrypted file it creates.
3. Move `credentials.json` and the keystore out of the project and into a password manager. `.gitignore` covers both, but this repository is public, so don't leave them in it.

If Play Console won't offer **Change key** until a build has been uploaded, upload one first (step 5), change the key, and only then roll the release out.

EAS keeps signing your uploads with the same key, so it's also your upload key. Google recommends a separate upload key for extra safety, but one key for both works.

## 4. Build the app bundle

Play takes an Android App Bundle (`.aab`), not the APKs the `development` and `preview` profiles make. The `production` profile in `eas.json` builds the bundle, signed with the key from step 3.

Android's `versionCode` must go up with every upload. EAS keeps it on its servers and raises it for each production build (`appVersionSource: remote` with `autoIncrement`), so you never edit it. Before each release, set `expo.version` in `app.json` to the version people see: 1.0.0 for the first release, then 1.0.1, 1.1.0 and so on.

```sh
npm test && npm run typecheck
eas build --platform android --profile production
```

The build takes about 20 minutes on EAS's free tier.

## 5. Upload to internal testing

Internal testing reaches up to 100 testers you name, usually within minutes. Use it to try the Play build on a phone first.

### Let EAS upload for you (one-time setup)

1. In the [Google Cloud console](https://console.cloud.google.com/), create or reuse a project. Go to **IAM & Admin → Service Accounts**, create a service account, and copy its email. Under **Manage keys**, add a key of type JSON and save the file.
2. In the same project, enable the **Google Play Android Developer API**.
3. In Play Console, go to **Users and permissions → Invite new users** and enter the service account's email. Under app permissions, pick Notch and allow:
   - View app information (read-only)
   - Edit and delete draft apps
   - Release to production, exclude devices, and use Play App Signing
   - Release apps to testing tracks
   - Manage testing tracks and edit tester lists
   - Manage store presence

   Then choose **Invite user**.
4. Give the key to EAS. Either run `eas credentials --platform android` and upload it under the Google Service Account options, or use the expo.dev dashboard (**Credentials → Android → com.rkwan.greater_than_zero → Service credentials**). Then delete the local JSON file, because anyone holding it can release your app.

### Upload

```sh
eas submit --platform android --profile production --latest
```

The `submit.production` profile in `eas.json` sends the build to the internal track as a draft release, so nothing reaches testers until you roll it out. In Play Console, open **Internal testing**, add release notes to the draft and roll it out.

`eas build --platform android --profile production --auto-submit` builds and uploads in one go. If you'd rather upload by hand, download the `.aab` from the build's page on expo.dev and add it under **Internal testing → Create new release**.

### Try it

Under **Internal testing → Testers**, make an email list with yourself on it, open the opt-in link on your phone and install from Play. If Play installs it as an update and your data is still there, the signing key matched. With a different key, Play refuses to install over the existing app. Then check what tests can't reach, such as the rest-end notification arriving on time and Backup export and import.

Installing the Play build replaces a development build on the same phone, because the package and key are the same. To develop again afterwards, install a new development build.

## 6. Fill in the store listing and app content

Play Console won't send the app for review until these are done. The dashboard lists what's missing.

**Main store listing:**

- App name (up to 30 characters), short description (up to 80) and full description (up to 4,000)
- App icon: 512×512 PNG
- Feature graphic: 1024×500 JPEG or PNG with no transparency
- At least two phone screenshots. Each side must be 320–3,840 px, and the long side can be at most twice the short side. Most phone screenshots are taller than that, so crop them (1080×1920 works).
- Category: Health & Fitness, plus a contact email, which is shown publicly

**App content** (under Policy):

- **Privacy policy:** the address of the policy you wrote.
- **Ads:** none.
- **App access:** everything works without signing in.
- **Content rating:** answer the questionnaire. There's no violence, no contact between users and nothing to buy.
- **Target audience:** the age groups you're making it for. Including any under 13 brings in Google's Families policy.
- **Data safety:** for v1, answer that the app collects and shares no user data. Play doesn't count data that's only processed on the phone. It also doesn't count transfers the user starts and expects, such as exporting a Backup file. Android Auto Backup goes to the user's own Google account, which the app never reads.
- **Health apps:** every app must complete this. Tick Activity and fitness, and Nutrition and weight management.
- **Advertising ID:** not used.
- **Exact alarms:** the declaration, if you kept `USE_EXACT_ALARM`.

Answer no to the remaining questions, such as government apps, financial features and news.

## 7. Run the closed test

New personal accounts need this before production access.

1. Under **Closed testing**, create a track and add at least 12 testers, as an email list or a Google Group, along with the countries they're in.
2. Promote the internal release to the closed track and send it for review. The first review can take several days.
3. Testers open the opt-in link and install from Play. Friends who already have an EAS build get it as an update and keep their data, because the key matches. Ask them to export a Backup first anyway.
4. Keep at least 12 testers opted in for 14 days in a row, and ask them to really use the app. Google asks about the test when you apply.
5. Then go to the dashboard, choose **Apply for production access**, and answer the questions about the test. Google usually replies within about a week.

## 8. Release to production

1. Under **Production**, choose the countries and regions where the app is available.
2. Create a release by promoting the closed-test release. A staged rollout to a share of users is optional.
3. Send it for review. A new app's first review can take a week or more.

## Shipping an update

1. Set the new `expo.version` in `app.json`.
2. Run `npm test && npm run typecheck`.
3. Run `eas build --platform android --profile production --auto-submit`. The build lands on internal testing as a draft.
4. Roll it out to internal testing and try it on your phone. Then, in Play Console, promote it to the closed track or production.

Migrations run at launch, so every update must open any older database. A migration that changes rows already there must also bump `backupFormatVersion` in `src/core/backup.ts` and add a matching upgrade step, or importing an older Backup file undoes it.

## Later

- **v2 photo analysis:** before the release that sends meal photos to Anthropic through the photo proxy, update the privacy policy and the Data safety form to say so (spec #1).
- **EAS Update** (spec story 87) isn't set up yet. When it is, give production builds their own channel.
- **Target API level:** Play raises the Android version that new apps and updates must target each August. Expo SDK 56 targets Android 16 (API 36), which has been required since 31 August 2026. Expect the next deadline to need a newer Expo SDK.
