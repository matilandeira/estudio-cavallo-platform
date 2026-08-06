-- ============================================================================
-- Estudio Cavallo — Operations Center
-- PostgreSQL schema for Supabase
--
-- Covers every entity found in the former localStorage-backed app:
-- cars, documents, properties, the "operational excellence" scoring log,
-- the signing appointments agenda, the two small scheduling queues, flagged
-- (objected) documents, recurring office tasks, and a single app-settings row.
--
-- AUTH: the app requires a signed-in Supabase Auth user (email/password —
-- see src/components/Login.jsx). Every table's Row Level Security policy
-- requires auth.role() = 'authenticated', so the anon key alone (no session)
-- can't read or write anything. Create staff accounts in the Supabase
-- dashboard under Authentication > Users (there's no self-serve sign-up).
--
-- AUDIT: tables staff actively edit carry created_by / updated_by columns
-- (uuid, references auth.users) so every row remembers who touched it last.
-- Both are stamped server-side — created_by via a column default of
-- auth.uid(), updated_by via the set_audit_columns() trigger below — so the
-- application code never needs to (and can't spoof) set them.
--
-- If you already ran an earlier version of this schema against a live
-- project, don't re-run this file — use auth_and_rls_migration.sql instead,
-- which upgrades an existing database in place without dropping data.
-- ============================================================================

create extension if not exists pgcrypto;

-- Keeps updated_at/updated_by current on every UPDATE. Only attached to
-- tables that have both columns.
create or replace function set_audit_columns()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql;

-- Same, but for the one table (recurring_task_completions) that tracks its
-- own "when" via completed_at instead of a generic updated_at.
create or replace function set_updated_by()
returns trigger as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- CARS (automotive transactions: sales, powers of attorney, trade-ins…)
-- ============================================================================
create table cars (
  id uuid primary key default gen_random_uuid(),
  case_date date not null default current_date,
  client text,
  phone text,
  financed boolean not null default false,
  plate_number text,
  registry_number text,                 -- "padrón"
  make_model text,
  plate_number_2 text,                  -- second vehicle, for trade-ins
  registry_number_2 text,
  make_model_2 text,
  case_type text not null default 'Sale'
    check (case_type in ('Sale', 'Power of Attorney', 'Sub-power of Attorney', 'Trade-in', 'Other')),
  assignees text[] not null default '{}',
  notarization_assignees text[] not null default '{}',
  lien_status text not null default 'not_requested'
    check (lien_status in ('not_requested', 'requested', 'ok')),
  seizure_status text not null default 'not_requested'
    check (seizure_status in ('not_requested', 'requested', 'ok')),
  debt_status text not null default 'not_requested'
    check (debt_status in ('not_requested', 'requested', 'ok')),
  sucive_certificate_status text not null default 'not_requested'
    check (sucive_certificate_status in ('not_requested', 'requested', 'ok')),
  required_plates_status text not null default 'not_requested'
    check (required_plates_status in ('not_requested', 'requested', 'ok')),
  document_drafted_status text not null default 'not_requested'
    check (document_drafted_status in ('not_requested', 'requested', 'ok')),
  paid_status text not null default 'not_requested'
    check (paid_status in ('not_requested', 'requested', 'ok')),
  status text not null default 'Pending'
    check (status in ('Pending', 'In Progress', 'Returned from Registry', 'Ready to Sign', 'Ready to Notarize', 'Notarized', 'Registering', 'Completed')),
  registry_filing_number text,          -- "número de ingreso"
  pin text,
  reminder_date date,
  priority text check (priority in ('Low', 'Medium', 'High')),
  notes text,
  completed_at date,
  ready_to_schedule boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cars_status_idx on cars (status);
create index cars_case_date_idx on cars (case_date);
create trigger cars_set_audit_columns before update on cars
  for each row execute function set_audit_columns();

-- ============================================================================
-- DOCUMENTS (certified copies, powers of attorney, estate probate, SAS, etc.)
-- ============================================================================
create table documents (
  id uuid primary key default gen_random_uuid(),
  case_date date not null default current_date,
  client text,
  phone text,
  document_type text not null default 'Certified Copy'
    check (document_type in (
      'Certified Copy', 'Notarial Certificate', 'Signature Certification',
      'General Power of Attorney', 'Special Power of Attorney', 'Notarial Deed',
      'Payment Receipt', 'Sub-power of Attorney', 'Estate Probate', 'SAS',
      'Document Scanning', 'Document Reconstruction', 'Other'
    )),
  reference text,
  assignees text[] not null default '{}',
  drafted boolean not null default false,
  reviewed boolean not null default false,
  delivered boolean not null default false,
  paid boolean not null default false,
  status text not null default 'Pending'
    check (status in ('Pending', 'In Progress', 'On Hold', 'For Review', 'Completed')),
  probate_status text not null default 'Gathering Information'
    check (probate_status in ('Gathering Information', 'First Filing Ready', 'First Filing Submitted', 'Publications', 'Second Filing Submitted', 'CRA', 'Registration')),
  power_of_attorney_status text not null default 'Gathering Data'
    check (power_of_attorney_status in ('Gathering Data', 'Document Ready', 'Signed', 'Delivered', 'Paid')),
  vehicle text,
  registry_number text,
  scan_status text not null default 'Pending'
    check (scan_status in ('Pending', 'Completed')),
  reconstruction_status text not null default 'Pending'
    check (reconstruction_status in ('Pending', 'Requested from Registry', 'Ready', 'Paid')),
  documentation_requested boolean not null default false,
  sas_status text not null default 'Missing Documentation'
    check (sas_status in ('Missing Documentation', 'Name Reservation', 'Registry Filing', 'RUT', 'Final')),
  next_action_owner text,
  reminder_date date,
  priority text check (priority in ('Low', 'Medium', 'High')),
  notes text,
  completed_at date,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_status_idx on documents (status);
create index documents_type_idx on documents (document_type);
create trigger documents_set_audit_columns before update on documents
  for each row execute function set_audit_columns();

-- ============================================================================
-- PROPERTIES (real estate — reservation agreement through registration)
-- ============================================================================
create table properties (
  id uuid primary key default gen_random_uuid(),
  case_date date not null default current_date,
  property_type text not null default 'Urban' check (property_type in ('Urban', 'Rural')),
  client text,
  registry_number text,                 -- "padrón"
  assignees text[] not null default '{}',
  registry_filing_number text,
  pin text,
  buyer_phone text,
  seller_phone text,
  notary_phone text,
  id_cards boolean not null default false,
  titles boolean not null default false,
  survey_plan boolean not null default false,
  property_tax_receipt boolean not null default false,
  school_tax_receipt boolean not null default false,
  cadastral_info boolean not null default false,
  project_plan boolean not null default false,
  personal_status_certificate boolean not null default false,
  property_certificate boolean not null default false,
  business_lien_certificate boolean not null default false,
  first_copy boolean not null default false,
  taxes_paid boolean not null default false,
  offering_certificate boolean not null default false,   -- rural only
  article_358_certificate boolean not null default false, -- rural only
  colonization_certificate boolean not null default false, -- rural only
  mining_certificate boolean not null default false,       -- rural only
  registration_status text not null default 'not_requested'
    check (registration_status in ('not_requested', 'requested', 'ok')),
  stage text not null default 'Preparing Agreement'
    check (stage in ('Preparing Agreement', 'Agreement Approved', 'Ready to Sign', 'Agreement Signed', 'Promise of Sale', 'Sale Deed', 'Registering', 'Documentation Received', 'Completed')),
  status text not null default 'Pending'
    check (status in ('Pending', 'In Progress', 'On Hold', 'For Review', 'Completed')),
  next_action_owner text,
  next_action text,
  reminder_date date,
  priority text check (priority in ('Low', 'Medium', 'High')),
  notes text,
  completed_at date,
  ready_to_schedule boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index properties_status_idx on properties (status);
create index properties_stage_idx on properties (stage);
create trigger properties_set_audit_columns before update on properties
  for each row execute function set_audit_columns();

-- ============================================================================
-- DAILY EXCELLENCE LOG (manual entries: Google reviews, for the scoring tab)
-- Append-only from the UI (no edit flow), so created_by is enough.
-- ============================================================================
create table daily_excellence_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null default current_date,
  google_reviews integer not null default 0,
  negative_reviews integer not null default 0,
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index daily_excellence_log_date_idx on daily_excellence_log (log_date);

-- ============================================================================
-- SIGNING APPOINTMENTS (the front-page agenda)
-- Append-only from the UI (no edit flow), so created_by is enough.
-- ============================================================================
create table signing_appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_date date not null,
  appointment_time time not null default '10:00',
  origin text not null default 'Car' check (origin in ('Car', 'Property')),
  client text,
  description text,                     -- make/model, or "Registry number …"
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index signing_appointments_date_idx on signing_appointments (appointment_date);

-- ============================================================================
-- DOCUMENTS READY TO SCHEDULE (queue that feeds into signing_appointments)
-- Append-only from the UI (no edit flow), so created_by is enough.
-- ============================================================================
create table documents_ready_to_schedule (
  id uuid primary key default gen_random_uuid(),
  client text,
  description text,                     -- vehicle/case description
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- PROPERTIES NEAR SIGNING (missing_items gets edited in place, so this one
-- gets both created_by and updated_by)
-- ============================================================================
create table properties_near_signing (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete set null,
  client text,
  registry_number text,
  missing_items text,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger properties_near_signing_set_audit_columns before update on properties_near_signing
  for each row execute function set_audit_columns();

-- ============================================================================
-- FLAGGED DOCUMENTS ("documentos observados" — registry objections)
-- ============================================================================
create table flagged_documents (
  id uuid primary key default gen_random_uuid(),
  flagged_date date not null default current_date,
  sector text not null default 'Vehicles' check (sector in ('Vehicles', 'Documents')),
  linked_record_id uuid,                -- optionally points at a cars.id or documents.id
  client text,
  registry_number text,
  make_model text,
  registry_filing_number text,
  pin text,
  document_description text,
  objection_details text,
  status text not null default 'Resolving'
    check (status in ('Resolving', 'Objection Filed', 'Objection Nearly Resolved', 'Objection Cleared', 'Completed')),
  priority text check (priority in ('Low', 'Medium', 'High')),
  resolved boolean not null default false,
  resolved_at date,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flagged_documents_resolved_idx on flagged_documents (resolved);
create trigger flagged_documents_set_audit_columns before update on flagged_documents
  for each row execute function set_audit_columns();

-- ============================================================================
-- RECURRING OFFICE TASKS
-- The task catalog itself (title, frequency, default assignees) stays as
-- static config in the frontend (src/lib/constants.js) since it rarely
-- changes; only completion state and assignee overrides are persisted here.
-- Both tables are upserted (never a plain insert), so a single updated_by
-- covers "who last touched this" — there's no separate creation event.
-- ============================================================================
create table recurring_task_completions (
  task_id text primary key,             -- matches the static task id, e.g. "r1"
  period_key text not null,             -- e.g. "2026-W32" or "2026-08"
  updated_by uuid references auth.users(id) default auth.uid(),
  completed_at timestamptz not null default now()
);
create trigger recurring_task_completions_set_updated_by before update on recurring_task_completions
  for each row execute function set_updated_by();

create table recurring_task_assignees (
  task_id text primary key,
  assignees text[] not null default '{}',
  updated_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now()
);
create trigger recurring_task_assignees_set_audit_columns before update on recurring_task_assignees
  for each row execute function set_audit_columns();

-- ============================================================================
-- APP SETTINGS (single row — currently just the "simple mode" UI toggle)
-- ============================================================================
create table app_settings (
  id boolean primary key default true check (id),
  simple_mode boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create trigger app_settings_set_audit_columns before update on app_settings
  for each row execute function set_audit_columns();
insert into app_settings (id, simple_mode) values (true, false);

-- ============================================================================
-- ROW LEVEL SECURITY — every operation requires a signed-in user
-- ============================================================================
alter table cars enable row level security;
alter table documents enable row level security;
alter table properties enable row level security;
alter table daily_excellence_log enable row level security;
alter table signing_appointments enable row level security;
alter table documents_ready_to_schedule enable row level security;
alter table properties_near_signing enable row level security;
alter table flagged_documents enable row level security;
alter table recurring_task_completions enable row level security;
alter table recurring_task_assignees enable row level security;
alter table app_settings enable row level security;

create policy "Authenticated users only" on cars for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on documents for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on properties for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on daily_excellence_log for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on signing_appointments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on documents_ready_to_schedule for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on properties_near_signing for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on flagged_documents for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on recurring_task_completions for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on recurring_task_assignees for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users only" on app_settings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
