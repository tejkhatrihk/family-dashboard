# Family Dashboard

A responsive household dashboard with account-based and managed family profiles, Google Calendar integration, recurring events, meals, recipes, and reminders. Household owners can designate child profiles and optionally enable separate, named lunch columns for each child.

See [ARCHITECTURE_AND_DATA.md](./ARCHITECTURE_AND_DATA.md) for the complete data model, privacy boundaries, cost model, sign-in flow, Google Calendar behavior, setup instructions, and production checklist.

Household events, meal plans, recipes, member profiles, invitations, and personal event-reminder settings are stored in Cloud Firestore. Legacy browser-only records are imported when they are missing from Firestore and removed from browser storage only after migration succeeds. Firestore's local cache is in-memory; family data is not persisted offline on the device.

## Firebase setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
2. Add a Web app to the project and copy its configuration values.
3. In **Authentication → Sign-in method**, enable Google.
4. Create a Cloud Firestore database in production mode.
5. Copy `.env.example` to `.env` and enter the Firebase web configuration.
6. Install the Firebase CLI and authenticate:

   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use --add
   ```

7. Deploy the Firestore rules and required index:

   ```sh
   firebase deploy --only firestore
   ```

Do not use Firestore test-mode rules for a deployed app. The included rules isolate household data to authenticated household members.

## Google Calendar setup

Google Calendar access is requested during Google sign-in. Users approve the requested Calendar permission in Google's consent screen. Access tokens expire, so the app asks the user to renew Calendar access when needed.

Existing users need to sign out and back in once after this change so Google can grant the Calendar permission during sign-in.

1. Enable the Google Calendar API in the same Google Cloud project.
2. Create a Web OAuth client.
3. Add `http://localhost:5174` and the deployed domain to Authorized JavaScript origins.
4. Configure the OAuth audience as External. While testing, add each tester under **Google Auth Platform → Audience → Test users**.
5. Put the OAuth client ID in `.env` as `VITE_GOOGLE_CLIENT_ID`.

For a household to see each member's events, members must share the relevant Google calendars with one another. Each new member's calendar ID defaults to their Google email address.

Dashboard events are always saved to Firestore, so they remain visible to household members who have not authorized Calendar access. When Calendar access is authorized, new dashboard events are also mirrored to the selected member's Google calendar. External Google events are visible only while that user's access token is valid.

## Install as a PWA

The app can be installed from its HTTPS website on supported phones, tablets, and desktop browsers. The service worker caches only the app shell and same-origin static assets; family data still needs an internet connection and is not cached for offline use.

1. Deploy the app to Firebase Hosting with `npm run build` followed by `firebase deploy --only hosting`.
2. Open the HTTPS site on the device and sign in.
3. On Android, use the browser menu's **Install app** or **Add to Home screen** action. On iPhone or iPad, open the site in Safari, tap **Share**, then **Add to Home Screen**.
4. On an Amazon Fire tablet, open the site in Silk and use its available **Add to Home Screen** option. Browser/Fire OS support varies by model; test the exact tablet before choosing it as the wall display.

For an old HP laptop, use Chrome or Edge and choose **Install this site as an app** from the browser menu. It can stay plugged in and open on the dashboard, but the lid/display sleep behavior may need to be adjusted in the laptop's power settings.

The PWA itself has no fee or app-store charge. Firebase Hosting currently includes 10 GB storage and 10 GB/month data transfer at no cost ([Firebase Hosting quotas](https://firebase.google.com/docs/hosting/usage-quotas-pricing)). This project also uses Cloud Functions for AI Quick Add, which requires the Blaze billing plan; that is pay-as-you-go and can incur charges. Check Firebase usage and configure budget alerts before deployment. Budget alerts notify you but do not cap charges.

To test without public hosting, run `npm run dev -- --host 0.0.0.0` and open the app from devices on the same Wi-Fi using the computer's local network address. Local development is not an installable PWA on other devices because browsers require HTTPS for service workers; use Firebase Hosting for installation testing.

## AI Quick Add setup

Quick Add always runs the local deterministic parser first. When that parser cannot confidently understand a sentence, the event preview offers an optional AI fallback. The AI response only fills the editable event form; it never creates an event automatically.

The OpenAI API key is stored in Google Cloud Secret Manager and is available only to the authenticated Firebase callable function. Never add it to `.env` or any `VITE_` variable.

1. Select the Firebase project and make sure it is on the Blaze plan, which is required to deploy Cloud Functions.
2. Store the OpenAI API key securely:

   ```sh
   firebase functions:secrets:set OPENAI_API_KEY
   ```

3. Build the updated UI and deploy it with the callable function:

   ```sh
   npm run build
   firebase deploy --only functions,hosting
   ```

The function sends only the Quick Add sentence, the current date/time zone, and family member IDs and display names. It does not send email addresses or write calendar data.

## Development

```sh
npm install
npm run dev
```

## Verification

```sh
npm run lint
npm run build
```
