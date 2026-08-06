/* Supabase/Postgres rejects "" for typed/constrained columns — dates and
   timestamps ("invalid input syntax for type date"), and the one enum
   column with a CHECK constraint whose allowed values don't include "" —
   but HTML inputs naturally produce "" for a cleared date picker or a
   "not set" <option>. Every payload built from form state (or merged from
   a partial patch) needs to pass through here before Supabase sees it.

   Applied in two places, deliberately redundant:
     1. Explicitly, at every component's save()/update() call site, so the
        sanitization is visible right next to the payload it protects.
     2. Centrally, inside useSupabaseCollection's insertRow/persist, as a
        safety net that covers all 8 tables even for call sites that
        construct a payload without going through a component's own
        save()/update() (e.g. AllWork.jsx's "mark flagged" action). Running
        it twice is a no-op — sanitizeForSupabase(sanitizeForSupabase(x))
        === sanitizeForSupabase(x). */

// Every date/timestamp column across all 11 tables in schema.sql ends in
// "_date" or "_at" (case_date, reminder_date, completed_at, log_date,
// appointment_date, flagged_date, resolved_at, created_at, updated_at) —
// never a text/number/boolean/uuid column, so this heuristic has zero false
// positives against the current schema.
const DATE_LIKE_KEY = /(^|_)(date|at)$/i;

// The only enum/CHECK-constrained column, across every table, that the UI
// ever lets the user explicitly leave blank. Every other constrained column
// (status, case_type, stage, sector, document_type, the tri-state
// *_status columns, …) is always driven by a <select> pre-populated with a
// real value — none of them offer an empty "not set" option.
const NULLABLE_ENUM_KEYS = new Set(["priority"]);

// NOT NULL, DEFAULT 0 count columns (daily_excellence_log). "" here must
// become 0, not null — null would itself violate NOT NULL. In practice the
// number inputs for these already coerce via Number(), so this is a
// backstop rather than an active fix.
const ZERO_DEFAULT_NUMERIC_KEYS = new Set(["google_reviews", "negative_reviews"]);

export function sanitizeForSupabase(payload) {
  const clean = { ...payload };
  for (const key of Object.keys(clean)) {
    if (clean[key] !== "") continue;
    if (DATE_LIKE_KEY.test(key)) clean[key] = null;
    else if (NULLABLE_ENUM_KEYS.has(key)) clean[key] = null;
    else if (ZERO_DEFAULT_NUMERIC_KEYS.has(key)) clean[key] = 0;
  }
  return clean;
}
