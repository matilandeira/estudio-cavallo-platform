-- ============================================================================
-- Estudio Cavallo — Operations Center
-- PostgreSQL schema for Supabase
--
-- Covers every entity found in the former localStorage-backed app:
-- cars, documents, properties, the "operational excellence" scoring log,
-- the signing appointments agenda, the two small scheduling queues, flagged
-- (objected) documents, recurring office tasks, and a single app-settings row.
--
-- SECURITY NOTE: this app has no login/auth screen yet, so every table below
-- is given a permissive Row Level Security policy that allows the public
-- "anon" key full read/write access — this matches today's no-auth behavior,
-- but it means anyone with the anon key (which ships in client-side code)
-- can read and modify every row, including client names and phone numbers.
-- Revisit this once Supabase Auth (or any login) is added: replace the
-- "Allow full access" policies with policies scoped to authenticated users.
-- ============================================================================

create extension if not exists pgcrypto;

-- Generic trigger to keep updated_at current on every UPDATE.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cars_status_idx on cars (status);
create index cars_case_date_idx on cars (case_date);
create trigger cars_set_updated_at before update on cars
  for each row execute function set_updated_at();

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_status_idx on documents (status);
create index documents_type_idx on documents (document_type);
create trigger documents_set_updated_at before update on documents
  for each row execute function set_updated_at();

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index properties_status_idx on properties (status);
create index properties_stage_idx on properties (stage);
create trigger properties_set_updated_at before update on properties
  for each row execute function set_updated_at();

-- ============================================================================
-- DAILY EXCELLENCE LOG (manual entries: Google reviews, for the scoring tab)
-- ============================================================================
create table daily_excellence_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null default current_date,
  google_reviews integer not null default 0,
  negative_reviews integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index daily_excellence_log_date_idx on daily_excellence_log (log_date);

-- ============================================================================
-- SIGNING APPOINTMENTS (the front-page agenda)
-- ============================================================================
create table signing_appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_date date not null,
  appointment_time time not null default '10:00',
  origin text not null default 'Car' check (origin in ('Car', 'Property')),
  client text,
  description text,                     -- make/model, or "Registry number …"
  notes text,
  created_at timestamptz not null default now()
);
create index signing_appointments_date_idx on signing_appointments (appointment_date);

-- ============================================================================
-- DOCUMENTS READY TO SCHEDULE (queue that feeds into signing_appointments)
-- ============================================================================
create table documents_ready_to_schedule (
  id uuid primary key default gen_random_uuid(),
  client text,
  description text,                     -- vehicle/case description
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- PROPERTIES NEAR SIGNING
-- ============================================================================
create table properties_near_signing (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete set null,
  client text,
  registry_number text,
  missing_items text,
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flagged_documents_resolved_idx on flagged_documents (resolved);
create trigger flagged_documents_set_updated_at before update on flagged_documents
  for each row execute function set_updated_at();

-- ============================================================================
-- RECURRING OFFICE TASKS
-- The task catalog itself (title, frequency, default assignees) stays as
-- static config in the frontend (src/lib/constants.js) since it rarely
-- changes; only completion state and assignee overrides are persisted here.
-- ============================================================================
create table recurring_task_completions (
  task_id text primary key,             -- matches the static task id, e.g. "r1"
  period_key text not null,             -- e.g. "2026-W32" or "2026-08"
  completed_at timestamptz not null default now()
);

create table recurring_task_assignees (
  task_id text primary key,
  assignees text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger recurring_task_assignees_set_updated_at before update on recurring_task_assignees
  for each row execute function set_updated_at();

-- ============================================================================
-- APP SETTINGS (single row — currently just the "simple mode" UI toggle)
-- ============================================================================
create table app_settings (
  id boolean primary key default true check (id),
  simple_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger app_settings_set_updated_at before update on app_settings
  for each row execute function set_updated_at();
insert into app_settings (id, simple_mode) values (true, false);

-- ============================================================================
-- ROW LEVEL SECURITY — open read/write for the anon key (no auth yet)
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

create policy "Allow full access" on cars for all using (true) with check (true);
create policy "Allow full access" on documents for all using (true) with check (true);
create policy "Allow full access" on properties for all using (true) with check (true);
create policy "Allow full access" on daily_excellence_log for all using (true) with check (true);
create policy "Allow full access" on signing_appointments for all using (true) with check (true);
create policy "Allow full access" on documents_ready_to_schedule for all using (true) with check (true);
create policy "Allow full access" on properties_near_signing for all using (true) with check (true);
create policy "Allow full access" on flagged_documents for all using (true) with check (true);
create policy "Allow full access" on recurring_task_completions for all using (true) with check (true);
create policy "Allow full access" on recurring_task_assignees for all using (true) with check (true);
create policy "Allow full access" on app_settings for all using (true) with check (true);
