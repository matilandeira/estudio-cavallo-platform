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

2. Create the database. In the Supabase SQL editor, run `schema.sql` first
   (creates every table, constraints and Row Level Security policies), then
   optionally `seed.sql` to load the office's existing records.

3. Copy your Supabase project URL and anon (public) key into `.env.local` at
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
through `src/lib/api.js`, so all staff see the same data in real time across
devices, no matter which browser or computer they use.

**Security note:** the app currently has no login screen, so every table
uses a permissive Row Level Security policy that grants the public anon key
full read/write access. That means anyone with the anon key (which ships in
the client-side JavaScript bundle) can read or modify the data, including
client names and phone numbers. This matches the app's current no-auth
behavior, but it should be revisited — add Supabase Auth and scope the RLS
policies to authenticated users before treating this as fully private.

## Structure

```
estudio-cavallo-platform/
├── index.html              # Root HTML that loads the app
├── package.json             # Dependencies and scripts
├── vite.config.js           # Vite configuration
├── schema.sql                # Database schema (tables, constraints, RLS)
├── seed.sql                  # Optional: migrates existing office records
├── .env.local                 # Supabase URL/key (gitignored)
└── src/
    ├── main.jsx               # React entry point
    ├── App.jsx                # Top-level shell: navigation and tabs
    ├── lib/
    │   ├── supabaseClient.js   # Supabase client (reads .env.local)
    │   ├── api.js                # CRUD helpers per table
    │   ├── constants.js          # Static option lists, procedures manual, recurring tasks
    │   ├── businessLogic.js      # Completion rules, scoring, WhatsApp links
    │   ├── format.js             # Date/time formatting helpers
    │   └── theme.js               # Design tokens and global styles
    ├── hooks/
    │   ├── useSupabaseCollection.js  # Generic list/insert/update/delete + optimistic UI
    │   ├── useAppSettings.js          # "Simple mode" toggle
    │   ├── useRecurringTasks.js       # Recurring office tasks completion/assignees
    │   └── useToasts.js                # Success/error toast notifications
    └── components/
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
