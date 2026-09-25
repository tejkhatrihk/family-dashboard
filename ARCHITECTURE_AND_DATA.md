# Family Dashboard: Architecture, Data, Privacy, and Operations

Last reviewed: September 24, 2026

## Decision summary

Family Dashboard uses Firebase Authentication for identity and Cloud Firestore as the primary application database. Google Calendar is an optional integration. Google Drive is not used as the application database; it may be added later as an explicit export or backup destination.

This architecture is intentional:

- Firestore supports concurrent edits, real-time updates, offline caching, structured queries, and security rules.
- A household can use the dashboard without granting Calendar access.
- A user's personal Google Drive quota is not consumed by normal application use.
- Users do not need to create Firebase projects or provide Firebase keys.
- Google Calendar authorization can expire or be revoked without making household data unavailable.

## System overview

```text
User's Google account
        |
        v
Firebase Authentication
  - identity and session
        |
        v
Cloud Firestore
  - households and members
  - invitation codes
  - events and checklists
  - meal plans
  - recipes
        |
        +--------------------------+
                                   |
                                   v
                         Optional Google Calendar
                         - event mirroring
                         - external event overlay
```

The Firebase web configuration identifies the application and is shared by every browser. Access is protected by Firebase Authentication and Firestore Security Rules, not by hiding the web API key.

Never put a Firebase Admin service-account key, private key, OAuth client secret, or refresh token in the browser application.

## What is stored where

### Firebase Authentication

Firebase Authentication maintains the sign-in account and session. It stores provider identity information such as the Firebase UID, Google provider association, email, display name, and profile photo URL.

Firebase Authentication does not receive or store the user's Google password.

### Cloud Firestore

The current data model is:

```text
users/{uid}
households/{householdId}
households/{householdId}/members/{uid}
households/{householdId}/events/{eventId}
households/{householdId}/menus/{yyyy-mm-dd}
households/{householdId}/recipes/{recipeId}
householdInvites/{inviteCode}
```

#### User profiles

`users/{uid}` stores:

- Firebase UID
- Email address
- Display name
- Google profile photo URL
- Last-seen timestamp
- Current household ID
- IDs of households the user has joined

#### Households and members

`households/{householdId}` stores:

- Household name
- Owner UID
- Creation and update timestamps

Each member document stores:

- UID
- Email address
- Display name
- Profile photo URL
- Role (`owner` or `member`)
- Dashboard color
- Google Calendar ID, normally the member's email address
- Join timestamp
- Invitation code used to join, when applicable
- Member type (`account` or `managed`)
- Whether the member can sign in independently

Households support two member models:

- **Account members** have an email address, accept an invitation, and sign in with their own Google account.
- **Managed members** are created by the household owner for children or other people without email. They appear throughout the dashboard and can be assigned events and checklists, but they have no login credentials and cannot access the household independently.

#### Invitations

`householdInvites/{inviteCode}` stores:

- Random invitation code
- Household ID
- Exact invited email address
- Inviting user's UID
- Pending or accepted status
- Creation and acceptance timestamps
- UID of the accepting user

An invitation can only be accepted by a signed-in Google account whose email matches the invited email.

#### Events and checklists

Each household event stores:

- Title and optional description
- Start and end date/time
- All-day status
- Assigned family member
- Calendar ID and dashboard color
- Recurrence definition
- Optional checklist items and completion state
- Associated Google Calendar event ID and calendar ID when synchronized
- Last-updated timestamp

Firestore is the source of truth for dashboard-created events. When Calendar is connected, the app also mirrors those events to the selected Google Calendar. If Calendar synchronization fails, the Firestore event remains available to the household.

#### Meal plans

Each menu document is keyed by date and can contain:

- Breakfast
- Lunch
- Child lunch
- Dinner
- Last-updated timestamp

#### Recipes

Each recipe document contains the recipe editor's fields, including its name, ingredients, instructions, metadata, and creation/update timestamps.

#### Not currently stored in Firestore

- Google passwords
- Google Calendar access tokens
- Browser notification permission
- Local reminder delivery history
- A persisted shopping list; the shopping list is currently a placeholder
- Large photos, videos, or file attachments

Large binary files should not be stored directly in Firestore. If attachments are added, use object storage and store only metadata and object references in Firestore.

### Browser local storage

The current browser stores:

- A short-lived Google Calendar OAuth access token, keyed by Firebase UID
- The Calendar token expiration time
- Reminder settings and reminder delivery state
- Legacy local events, meals, or recipes until migration occurs

Calendar tokens are removed when they expire or when the user disconnects Calendar. A production security review should consider keeping access tokens in memory or session storage instead of persistent local storage.

### Google Calendar

Calendar access is optional and separate from Firebase sign-in.

When connected:

- Dashboard-created events can be mirrored into a selected Google Calendar.
- Recurrence is translated into Google Calendar recurrence rules.
- Checklists are included in private extended event properties.
- Google events can be displayed as an overlay in the dashboard.

To read or modify another family member's calendar, that calendar must be shared with the currently connected Google account and the account must have sufficient permission. A household membership in Firestore does not automatically grant Google Calendar access.

For a simpler production experience, consider adding one shared household calendar and letting members opt into personal-calendar synchronization.

### Google Drive

Google Drive is not part of normal persistence. A future export feature can create user-requested JSON, CSV, or printable backup files in Drive using the narrow `drive.file` scope.

Drive should not become the primary database because it lacks database transactions, real-time document subscriptions, efficient structured queries, and simple conflict handling for concurrent family edits.

## Sign-in and household flow

### First household member

1. The user selects **Continue with Google**.
2. Firebase Authentication verifies the Google identity and creates or restores a Firebase session.
3. The app creates or updates `users/{uid}`.
4. The user chooses **Create household** and enters a household name.
5. Firestore creates the household, owner membership, and user-to-household relationship in one batch.
6. Existing browser-local events, meals, and recipes are migrated when the new household collections are empty.

### Invited household member

1. The owner enters the member's exact Google email address.
2. Firestore creates a random, email-bound invitation code.
3. The owner sends the code to the intended member.
4. The member signs in with the invited Google account.
5. The member chooses **Join household** and enters the code.
6. Firestore verifies the invite email and atomically creates the membership, updates the user profile, and marks the invite accepted.

Every person uses an individual Google account. A shared family email account is not required.

### Member without an email address

1. The household owner opens **Add family member**.
2. The owner selects **Without email** and enters the person's display name.
3. Firestore creates a managed member document with no email and no sign-in ability.
4. The managed profile appears in the family list and event-assignment controls.
5. An adult household member manages that profile and its events.

The managed profile initially uses its creator's Google Calendar ID for optional mirroring. Firestore remains the source of truth, so other household members still see the event even when they do not have permission to write to that Google Calendar.

Managed profiles are not Firebase Authentication users. If a managed member later needs their own login, the product will need an explicit conversion/linking workflow; changing the name or adding an email alone must not silently grant account access.

## Authorization and isolation

The repository includes `firestore.rules`. Important protections include:

- A user can read and update only their own user profile.
- A household can be read only by its owner or members.
- Only household members can read or modify that household's meals, recipes, and events.
- Only the household owner can manage the household document and create invitations.
- Only the household owner can create managed profiles that do not have login accounts.
- Invitation reads and acceptance are limited to the invited email or household owner.
- A member can update only permitted fields on their own membership.
- Material deletes are denied unless explicitly permitted by the rules.

Rules are part of the security boundary and must be deployed before the app is used. Front-end checks are usability controls, not security controls.

Deploy rules and indexes from the repository root:

```sh
firebase login
firebase use --add
firebase deploy --only firestore
```

Do not deploy Firestore test-mode rules to a public application.

## Firebase and Google setup

### Firebase web application

The `.env` file requires:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

These values are public web configuration identifiers. `.env` is excluded from Git to avoid mixing environment-specific configuration into source control.

### Firebase Authentication

1. Open **Firebase Console -> Security -> Authentication**.
2. Enable the Google provider.
3. Select a support email.
4. Add `localhost` under Authorized domains for local development.
5. Add the production hostname before deployment.

The console warning `Cross-Origin-Opener-Policy policy would block the window.closed call` can be emitted by Chrome during Google popup sign-in. It is not itself an authentication failure. Look for a separate `FirebaseError` if sign-in does not complete.

### Cloud Firestore

1. Open **Firebase Console -> Databases & Storage -> Firestore Database**.
2. Create a Standard edition database in production mode.
3. Select a region near the primary user base; the location cannot be changed later.
4. Deploy the included rules and indexes.

### Google Calendar

1. Enable the Google Calendar API in Google Cloud.
2. Create a Web OAuth client.
3. Add `http://localhost:5174` and the production origin as Authorized JavaScript origins.
4. Configure the OAuth audience.
5. While the OAuth application is in Testing, add every Calendar tester under **Google Auth Platform -> Audience -> Test users**.
6. Configure these variables:

```text
VITE_GOOGLE_CLIENT_ID
VITE_GOOGLE_CALENDAR_SCOPES=https://www.googleapis.com/auth/calendar.events
```

Firebase login and Calendar authorization are intentionally separate. Users can use the dashboard without granting access to their private calendars.

## Cost model

The Firebase Spark plan requires no payment method and is appropriate for development and small-scale testing. At the time of this review, the Cloud Firestore Standard free quota includes:

- 1 GiB stored data
- 50,000 document reads per day
- 20,000 document writes per day
- 20,000 document deletes per day
- 10 GiB outbound data transfer per month

Official references:

- <https://firebase.google.com/pricing>
- <https://firebase.google.com/docs/firestore/pricing>
- <https://firebase.google.com/docs/auth/limits>

Pricing and quotas can change; verify them before launch.

The expected text data for a small household is tiny relative to the free storage quota. Reads are more likely than storage to become the first meaningful cost because real-time listeners count document reads when results are initially loaded or changed.

For commercial launch:

- Move to Blaze only when required by usage or production services.
- Configure Google Cloud billing budgets and alerts before enabling billing.
- Monitor Firestore reads, writes, storage, and Authentication active users.
- Add sensible query limits and avoid listeners that load unbounded history.
- Treat infrastructure cost as part of the subscription price rather than consuming the customer's Drive quota.

## Privacy and user controls

Before a public release, the product should provide:

- A privacy policy describing Firebase and Google Calendar processing
- A clear explanation of what Calendar access permits
- Household leave and member-removal controls
- Household ownership transfer
- Account deletion and household deletion
- Export in a portable format such as JSON or CSV
- Calendar disconnect and token revocation guidance
- Data-retention and deletion timelines
- A support process for accidental household lockout

When a user disconnects Google Calendar, existing Firestore data remains. Disconnecting Calendar does not delete events from Google Calendar; deletion behavior should be explicit and confirmed by the user.

## Current limitations and recommended backlog

1. Implement owner-controlled member removal and invitation cancellation.
2. Add household ownership transfer before allowing owner deletion.
3. Add account deletion and household data deletion workflows.
4. Add a user-initiated export/download feature; optionally export to Drive.
5. Add a proper shared household-calendar option instead of relying only on personal calendar sharing.
6. Define deterministic two-way Calendar conflict handling.
7. Avoid storing long-lived OAuth credentials in browser storage.
8. Persist and generate the shopping list.
9. Add pagination or date-bounded Firestore queries before event history becomes large.
10. Add automated tests for Firestore Rules using the Firebase Emulator Suite.
11. Add audit fields such as `createdBy`, `updatedBy`, and `updatedAt` consistently.
12. Add an explicit consent screen for local-data migration.
13. Add a secure workflow for converting a managed child profile into an account member without losing assignments or history.

## Production launch checklist

- [ ] Google provider enabled in Firebase Authentication
- [ ] Development and production domains authorized
- [ ] Firestore database created in the intended region
- [ ] `firestore.rules` deployed and emulator-tested
- [ ] `firestore.indexes.json` deployed
- [ ] OAuth consent screen configured
- [ ] Calendar API enabled
- [ ] OAuth tester restrictions understood or verification completed
- [ ] Production environment variables configured
- [ ] Budget alerts configured before enabling billing
- [ ] Privacy policy and terms published
- [ ] Account and household deletion implemented
- [ ] Export capability implemented
- [ ] Error monitoring and backup/restore plan established

## Architecture rule going forward

Use Firestore for structured, shared application state. Use Google Calendar for optional calendar interoperability. Use Google Drive only for user-initiated import, export, or backup files. Do not make a customer's personal Drive the operational database for the product.
