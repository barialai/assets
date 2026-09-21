# Assets v6 - Turn on private sync and daily backups

## What works immediately, and what needs setup

The exact supplied gold tick, mobile Quick Update screen, complete desktop
workspace, custom date picker, local saving and JSON backup/restore work without
a database.

Cloud sync and automatic end-of-day backups are implemented, but NOT enabled by
opening the HTML file or uploading only index.html. Follow the setup below. No
GitHub, Vercel or Supabase project has been changed by this download.

The backend is a single-owner workspace: your owner account signs in on each
device. There is no public registration. Do not use this as a public multi-user
financial service without further security and operational review.

## 1. Preserve your current records

On the existing website, open Backup & restore and download a full JSON backup.
Keep that file privately on your computer. Do not upload it to GitHub, Vercel,
the public website folder, or this source package.

The storage key and v2 ledger format have not changed. Updating the same website
origin should retain that browser's local records. A different domain, browser,
or home-screen app context may need a JSON restore or cloud login.

## 2. Create the private database

Use a dedicated Supabase project. In its SQL editor, run the contents of:

1. `database/01-schema.sql`
2. `database/02-scheduler.sql`

If the second script reports that pg_cron is unavailable, enable Cron in the
project's Integrations area, then rerun it. The named job is `vault-end-of-day`.
It checks every five minutes; it creates one snapshot per completed local day.
It runs inside the database, not in a browser and not on Vercel Hobby Cron.

The scripts create access-controlled workspace and backup tables, private
revision history, authenticated RPC functions and scheduler health information.
The `vault_private` schema must NOT be added to exposed Data API schemas.

Create your owner account under Authentication -> Users. Use your own email and
a strong password. Follow any invitation/confirmation steps the dashboard
requires. Disable public sign-ups for this personal project.

Copy your owner's User ID (UUID). In `database/03-owner.sql`, replace the
placeholder with that UUID and run the script. This authorizes only that owner.
Do not paste a password into SQL or source files.

## 3. Add five Vercel environment variables

In your Vercel project settings, add these variables to the PRODUCTION
environment. Do not put their values in GitHub or frontend JavaScript.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your project's HTTPS URL, e.g. `https://YOUR-PROJECT.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | The project's `sb_publishable_...` key |
| `VAULT_OWNER_ID` | The exact owner User ID authorized above |
| `VAULT_SESSION_SECRET` | A cryptographically random 32-byte key, encoded as 64 hexadecimal characters |
| `APP_ORIGIN` | Your production website origin, e.g. `https://assets-roan-xi.vercel.app`, with NO trailing slash |

Generate the session secret on your computer with Node:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the result directly into Vercel's environment-variable setting. Do not
commit it. Rotating it invalidates existing session cookies and requires a new
sign-in. Never use the placeholder value from `.env.example`.

This implementation needs NO Supabase secret or legacy service-role key.
The API uses the publishable key plus the signed-in owner's JWT; database
permissions and row-level security still apply. Auth tokens live in an encrypted
Secure/HttpOnly/SameSite=Strict session cookie, not JavaScript localStorage.

`APP_ORIGIN` must match the website address you actually open. Preview URLs and
other domains are deliberately rejected for writes. Use separate configuration
and a separate test database for previews; do not connect unreviewed preview
code to production financial records.

## 4. Update your existing GitHub / Vercel project

Extract the ZIP and put its CONTENTS in the root of your existing `assets`
repository. Keep the directory structure, particularly `api/`, `lib/`,
`database/`, `scripts/` and `icons/`. Replace the prior `index.html`, `app.js`
and `styles.css` with the included files. Include `tickmark.png`, the manifest,
service worker, `package.json` and `vercel.json` too.

Do not upload the ZIP itself as the website, and do not update only the old
standalone HTML file. The homepage uses index.html and the separate assets.
The downloadable standalone HTML is for local use, not the cloud backend.

Vercel project settings:

- Framework preset: Other (the supplied vercel.json uses no framework).
- Root directory: repository root.
- Build command: `npm run build`.
- Output directory: `public`.
- Node runtime: 22.x.

The build script has an explicit public-file allow-list. It does not publish
SQL, tests, .env files, old HTML builds, or JSON backups. Never commit private
backups anyway: excluding them from deployment does not make a public GitHub
commit private.

Commit the update to the connected production branch and redeploy. Environment
variable changes require a fresh deployment. No production npm dependencies
are needed. The `/api/vault` function is part of the complete Vercel package.

## 5. Connect your real workspace once

Open your production website and choose Cloud & daily backups. Sign in using
your owner email and password. On this FIRST device, make sure the correct
local accounts are showing. Restore your latest JSON backup first if needed.

Confirm the backup time zone, then choose Upload this workspace. This sends the
whole current ledger once; it does not replay transactions or repayments. Demo
records cannot be uploaded. The time-zone suggestion comes from your browser;
confirm it rather than assuming it is correct.

Wait for Cloud up to date. Choose Create cloud backup, then Load history. Download
that manual snapshot and check that it contains your workspace. This is a useful
end-to-end deployment test before relying on unattended backups.

Run `database/04-verify.sql` in Supabase to inspect configuration without reading
financial records. Also inspect the named Cron job's History for failures.

## 6. Continue on your phone

Open the SAME production domain on your phone. Sign in under Cloud & daily
backups and choose Continue with cloud data. Do NOT upload a blank phone
workspace over your existing cloud data.

Open Quick Update. Add it to your home screen:

- iPhone Safari: Share -> Add to Home Screen; enable Open as Web App if offered.
- Android: browser menu -> Install app / Add to Home screen, when offered.

The installed app starts at `/?quick=1#quick`. It exposes spending, money in,
profit/loss, internal transfers, current-balance corrections and loan payments.
Full dashboard is always one tap away. Desktop charts, settings, reports, loan
history, images, JSON restore and all other pages remain in the same application.
Some platforms share website storage with the installed app and others may not;
sign in and choose the cloud copy in any new storage context.

## How daily backups actually work

For each linked workspace, the scheduler targets 00:05 in its saved time zone.
It saves the last SERVER-SAVED revision from before the preceding midnight,
labelled with that completed day's date. Changes after midnight are not silently
inserted into yesterday's copy. Scheduling is best effort, not a financial SLA.

The database job continues when the website is closed, provided the project and
scheduler remain operational. Changes still offline on a phone are NOT on the
server. They sync only when the app is open, online and signed in again, and do
not rewrite older daily snapshots. Check Cloud up to date before closing after
important edits.

Backups include your accounts, entries, loans, repayments, profile image, logos,
currency settings and saved valuation history. Retention is 90 days. A maximum
seven-day catch-up window handles interrupted job runs, where historical
revisions exist. Revisions retain eight recent days plus an older baseline.
No history from before the first server save is invented.

Daily jobs are idempotent. Retrying a job cannot create a second daily snapshot
for the same owner/date. Normal edits use revision checks and mutation IDs.
Conflicting offline/device copies pause syncing for review instead of silently
using last-write-wins. There is no automatic two-way merge. Use one active editing
device at a time; allow it to finish syncing before switching.

A cloud restore first keeps a pre-restore snapshot and then replaces the current
workspace. New daily copies continue from that revision. A deliberate local
replacement similarly keeps a before-replace snapshot. JSON file restores on a
linked device also sync their replacement to the cloud.

## Privacy and operational limits

The gold tick is your chosen profile decoration, not third-party identity
verification. Cloud authentication is a separate login and security mechanism.

Local records, local recovery copies and downloaded JSON are not encrypted by
this app. Only use trusted devices and screen locks. Sign out & clear this device
clears the active local workspace, local recovery copy and cloud-link metadata;
saved downloads still remain on disk. It is not a substitute for securing your
computer or phone.

Cloud snapshots are access-controlled copies INSIDE the same Supabase project.
They protect against accidental workspace changes, but are NOT an independent
disaster-recovery copy. A deleted, paused, inaccessible or corrupted project can
affect both active data and snapshots. Keep periodic private JSON downloads
outside the project and consider provider-level backup/recovery options.

The cloud request limit is 3 MB. Local JSON restore still accepts up to 12 MB,
subject to the browser's storage quota. Server snapshots can consume storage,
especially with large images and frequent edits. Monitor database size, Cron
errors, provider quotas and service status. Nothing in this package guarantees
that a provider's free tier remains continuously available or without limits.

Financial values and currency conversion remain manual. There is no exchange,
bank or trading-bot connection, and no access to your banking credentials.

## Troubleshooting

"Local only": verify all five production environment variables, full package
deployment and the production domain. Opening the standalone file is local only.

"Request origin was rejected": APP_ORIGIN must exactly match the HTTPS origin
in your address bar, without a trailing slash. Redeploy after correcting it.

"Add your user to the database allow-list": run 03-owner.sql with the correct
UUID; it must match VAULT_OWNER_ID and the account you are signing into.

"Scheduler not installed": enable Cron and run 02-scheduler.sql. Inspect job
History. "Scheduler needs attention" means its last successful heartbeat is
missing or stale; do not assume that daily copies are still being created.

"Review device copies": download the local JSON first. Choose the current
cloud copy, or explicitly replace cloud with local after reviewing both.

"Cloud workspace limit is 3 MB": keep a local JSON backup, then reduce oversized
images or unnecessary data before syncing. Do not delete records blindly.

## Official implementation references

- Supabase Cron: https://supabase.com/docs/guides/cron
- Cron quickstart: https://supabase.com/docs/guides/cron/quickstart
- Row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Database functions: https://supabase.com/docs/guides/database/functions
- API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Password authentication: https://supabase.com/docs/guides/auth/passwords
- Vercel Cron limits: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Manifest shortcuts: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts
- iPhone home-screen web apps: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios


## Optional daily status email

The dashboard can store an opt-in email preference in the private workspace. To actually send mail, run `database/05-email-digest.sql` after configuring a Resend account and a verified sender domain. Store the API key with Supabase Vault using the example commands at the top of that SQL file; never put the key in GitHub, Vercel frontend variables or browser code. The database scheduler sends at most one status message for each completed local day, after the daily backup exists.
