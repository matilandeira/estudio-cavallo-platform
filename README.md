# Estudio Cavallo — Operations Center

React (Vite) app for Estudio Cavallo's case management system: Cars,
Documents, Properties, Operational Excellence and Work, backed by
[Supabase](https://supabase.com) (PostgreSQL) as the primary database.

## Requirements

- [Node.js](https://nodejs.org) version 18 or higher (includes `npm`)
- A Supabase project (URL + anon key)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the database. In the Supabase SQL editor:
   - **New project:** run `schema.sql` (creates every table, constraints,
     audit columns, Row Level Security policies, and enables realtime on the
     tables the UI keeps live), then optionally `seed.sql` to load the
     office's existing records.
   - **Existing project, pre-auth** (already ran an earlier version of
     `schema.sql` before auth was added): run `auth_and_rls_migration.sql`,
     then `realtime_migration.sql`. Both upgrade the tables in place without
     touching existing data.
   - **Existing project, already has auth** (just adding realtime): run only
     `realtime_migration.sql`.

3. Enable email/password sign-in and create staff accounts: in the Supabase
   dashboard go to **Authentication > Providers** and confirm Email is
   enabled, then **Authentication > Users > Add user** for each staff member.
   There's no self-serve sign-up screen — accounts are provisioned by an
   admin, matching how the rest of the office's tools work.

4. Copy your Supabase project URL and anon (public) key into `.env.local` at
   the repo root (already present in this checkout, but if you're setting up
   a new environment):

   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

   `.env.local` is gitignored — never commit real keys.

## Development

```bash
npm run dev
```

This prints an address like `http://localhost:5173` — open it in your browser.

## Production build

```bash
npm run build
```

This creates a `dist/` folder ready to deploy to any static host (Netlify,
Vercel, your own server, etc.).

## Data storage

All data lives in Supabase/PostgreSQL — every screen reads and writes
through `src/lib/api.js`.

## Realtime

`src/hooks/useSupabaseCollection.js` — the hook behind cars, documents,
properties, the daily excellence log, signing appointments, the two
scheduling queues, and flagged documents — subscribes to Postgres Changes
(`supabase.channel(...).on('postgres_changes', ...)`) for its table in
addition to its initial fetch. When any signed-in user inserts, edits, or
deletes a row, every other connected client's local state updates
immediately, no page refresh needed; each subscription is cleaned up
(`supabase.removeChannel`) when the component unmounts. This only works
because those tables are in the `supabase_realtime` publication (set up by
`schema.sql`/`realtime_migration.sql`) — enabling RLS alone doesn't turn
realtime on.

## Authentication & security

The app requires a signed-in Supabase Auth user — `src/components/Login.jsx`
signs in with `supabase.auth.signInWithPassword`, and `src/App.jsx` shows
that screen instead of the app whenever there's no active session (tracked
live via `supabase.auth.onAuthStateChange`).

Every table's Row Level Security policy requires `auth.role() = 'authenticated'`
for every operation (select/insert/update/delete), so the anon key alone —
even though it ships in the client-side bundle — can't read or write
anything without a valid session. Accounts are provisioned by an admin in
the Supabase dashboard (see Setup above); there's no self-serve sign-up.

Tables staff actively edit also carry `created_by`/`updated_by` columns
(`uuid references auth.users`), stamped automatically server-side — via a
column default of `auth.uid()` on insert, and a trigger on update — so the
application code never sets them directly and can't spoof who made a change.

## Structure

```
estudio-cavallo-platform/
├── index.html              # Root HTML that loads the app
├── package.json             # Dependencies and scripts
├── vite.config.js           # Vite configuration
├── schema.sql                # Database schema (tables, constraints, audit columns, RLS, realtime)
├── auth_and_rls_migration.sql # In-place upgrade for a pre-auth database (see Setup)
├── realtime_migration.sql     # In-place upgrade to enable realtime (see Setup)
├── seed.sql                  # Optional: migrates existing office records
├── .env.local                 # Supabase URL/key (gitignored)
└── src/
    ├── main.jsx               # React entry point
    ├── App.jsx                # Auth gate only: spinner / Login / AuthenticatedApp
    ├── lib/
    │   ├── supabaseClient.js   # Supabase client (reads .env.local)
    │   ├── api.js                # CRUD helpers per table
    │   ├── constants.js          # Static option lists, procedures manual, recurring tasks
    │   ├── businessLogic.js      # Completion rules, scoring, WhatsApp links
    │   ├── format.js             # Date/time formatting helpers
    │   └── theme.js               # Design tokens and global styles
    ├── hooks/
    │   ├── useAuth.js                 # Supabase Auth session state + sign out
    │   ├── useSupabaseCollection.js  # list/insert/update/delete + optimistic UI + realtime sync
    │   ├── useAppSettings.js          # "Simple mode" toggle
    │   ├── useRecurringTasks.js       # Recurring office tasks completion/assignees
    │   └── useToasts.js                # Success/error toast notifications
    └── components/
        ├── Login.jsx            # Sign-in screen (email/password)
        ├── AuthenticatedApp.jsx # Everything that needs a session: nav, tabs, data hooks
        ├── SharedUI.jsx        # Buttons, badges, pickers, filter bar, header
        ├── Home.jsx             # Home tab: agenda, reminders, KPIs, recurring tasks
        ├── Cars.jsx              # Cars tab
        ├── Documents.jsx         # Documents tab
        ├── Properties.jsx        # Properties tab
        ├── Excellence.jsx        # Operational Excellence tab
        ├── AllWork.jsx            # All Work tab
        ├── FlaggedDocuments.jsx   # Flagged (objected) documents panel
        └── Manual.jsx              # Procedures manual tab
```
