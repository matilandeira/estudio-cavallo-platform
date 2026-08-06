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

5. (Optional) To use the AI Chat Assistant, get an API key from the
   [Anthropic Console](https://console.anthropic.com) and set it as
   `ANTHROPIC_API_KEY` — see the AI Chat Assistant section below for where
   that needs to go. Without it, the chat widget still works but shows a
   friendly "not configured yet" message instead of a response.

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
Vercel, your own server, etc.) — **except** the AI Chat Assistant, which
needs `api/chat.js` to run as a Vercel Serverless Function and therefore
only works when this app is deployed on Vercel (or run locally with
`vercel dev` instead of `npm run dev`). The rest of the app doesn't depend
on Vercel at all.

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

## AI Chat Assistant

A floating widget (bottom-right, on every tab) lets signed-in staff ask
plain-language questions ("¿Qué escrituras se firman esta semana?", "¿Hay
trámites atrasados?") and get answers grounded in the office's actual
current data.

- `src/components/AIChatModal.jsx` — the widget. Sends the conversation to
  `POST /api/chat` with the user's Supabase access token in the
  `Authorization` header.
- `api/chat.js` — a Vercel Serverless Function (Node.js, `@anthropic-ai/sdk`
  + `@supabase/supabase-js`). It:
  1. Rejects the request unless it carries a valid Supabase session token —
     without this, the endpoint would be an open proxy to a paid Anthropic
     key for anyone on the internet.
  2. Builds a compact summary of pending cars, documents, active
     properties, upcoming signings, overdue reminders, and open flagged
     documents, querying Supabase **with that same user's token** so the
     results respect the exact same Row Level Security as the browser.
  3. Sends that summary as the system prompt to `claude-3-5-haiku-20241022`
     along with the conversation, and returns the reply.

**API key handling:** `ANTHROPIC_API_KEY` is read only via
`process.env.ANTHROPIC_API_KEY` inside `api/chat.js` — a Node.js-only
context that never ships to the browser. It is deliberately **not**
prefixed `VITE_`: Vite embeds every `VITE_*` variable into the client-side
JS bundle at build time, which is correct for the public Supabase anon key
(designed to be exposed, protected by RLS) but would leak this paid,
account-billing Anthropic key to anyone who opens devtools. Set it in two
places:
- `.env.local` (already has a blank placeholder) — read by `vercel dev` for
  local testing.
- Vercel dashboard → Project Settings → Environment Variables — required
  for the deployed function; `.env.local` is gitignored and never deployed.

If the key isn't set, `api/chat.js` returns
`{ error: 'API_KEY_MISSING', message: 'El chat de IA aún no tiene configurada la API Key en Vercel.' }`
instead of crashing, and the widget shows that message as a chat bubble.

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
├── .env.local                 # Supabase URL/key + ANTHROPIC_API_KEY (gitignored)
├── api/
│   └── chat.js                 # Vercel Serverless Function backing the AI Chat Assistant
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
        ├── AIChatModal.jsx       # Floating AI Chat Assistant widget (calls /api/chat)
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
