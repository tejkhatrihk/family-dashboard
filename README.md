# Family Dashboard

A responsive household dashboard with account-based and managed family profiles, Google Calendar integration, recurring events, meals, recipes, and reminders.

See [ARCHITECTURE_AND_DATA.md](./ARCHITECTURE_AND_DATA.md) for the complete data model, privacy boundaries, cost model, sign-in flow, Google Calendar behavior, setup instructions, and production checklist.

Household events, meal plans, recipes, member profiles, and invitations are stored in Cloud Firestore. Existing browser-local events, meals, and recipes are migrated into the first household automatically when its shared collections are empty.

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

Calendar access is separate from dashboard sign-in. Users can enter the dashboard with basic Google identity permissions and choose **Connect Google Calendar** later.

1. Enable the Google Calendar API in the same Google Cloud project.
2. Create a Web OAuth client.
3. Add `http://localhost:5174` and the deployed domain to Authorized JavaScript origins.
4. Configure the OAuth audience as External. While testing, add each tester under **Google Auth Platform → Audience → Test users**.
5. Put the OAuth client ID in `.env` as `VITE_GOOGLE_CLIENT_ID`.

For a household to see each member's events, members must share the relevant Google calendars with one another. Each new member's calendar ID defaults to their Google email address.

Dashboard events are always saved to Firestore, so they remain visible to household members who have not connected Calendar. When Calendar is connected, new dashboard events are also mirrored to the selected member's Google calendar. External Google events are visible only while that user has Calendar connected.

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
