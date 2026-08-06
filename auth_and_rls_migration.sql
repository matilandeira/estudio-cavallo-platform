-- ============================================================================
-- Estudio Cavallo — Auth + strict RLS migration
--
-- Run this ONCE against the live project that already has schema.sql (and
-- probably seed.sql) applied — it upgrades the existing tables in place
-- without dropping any data. Safe to run in the Supabase SQL editor, which
-- executes as the postgres role and therefore bypasses RLS.
--
-- What this does:
--   1. Adds created_by / updated_by (uuid -> auth.users) to every table that
--      needs one, stamped server-side (never trust the client for these).
--   2. Replaces the old "Allow full access" (anon-friendly) RLS policies
--      with policies that require auth.role() = 'authenticated'.
--
-- Prerequisite: create at least one staff account in the Supabase dashboard
-- under Authentication > Users before relying on this — once this migration
-- runs, the anon key alone can no longer read or write anything.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Audit-column trigger functions
-- ----------------------------------------------------------------------------
create or replace function set_audit_columns()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql;

create or replace function set_updated_by()
returns trigger as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- 2. Add created_by / updated_by columns
-- ----------------------------------------------------------------------------
alter table cars add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table cars add column if not exists updated_by uuid references auth.users(id);

alter table documents add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table documents add column if not exists updated_by uuid references auth.users(id);

alter table properties add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table properties add column if not exists updated_by uuid references auth.users(id);

alter table daily_excellence_log add column if not exists created_by uuid references auth.users(id) default auth.uid();

alter table signing_appointments add column if not exists created_by uuid references auth.users(id) default auth.uid();

alter table documents_ready_to_schedule add column if not exists created_by uuid references auth.users(id) default auth.uid();

alter table properties_near_signing add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table properties_near_signing add column if not exists updated_by uuid references auth.users(id);
alter table properties_near_signing add column if not exists updated_at timestamptz not null default now();

alter table flagged_documents add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table flagged_documents add column if not exists updated_by uuid references auth.users(id);

alter table recurring_task_completions add column if not exists updated_by uuid references auth.users(id) default auth.uid();

alter table recurring_task_assignees add column if not exists updated_by uuid references auth.users(id) default auth.uid();

alter table app_settings add column if not exists updated_by uuid references auth.users(id);

-- ----------------------------------------------------------------------------
-- 3. (Re)attach triggers — drop the old set_updated_at-based ones first so
--    this script can be re-run safely.
-- ----------------------------------------------------------------------------
drop trigger if exists cars_set_updated_at on cars;
drop trigger if exists cars_set_audit_columns on cars;
create trigger cars_set_audit_columns before update on cars
  for each row execute function set_audit_columns();

drop trigger if exists documents_set_updated_at on documents;
drop trigger if exists documents_set_audit_columns on documents;
create trigger documents_set_audit_columns before update on documents
  for each row execute function set_audit_columns();

drop trigger if exists properties_set_updated_at on properties;
drop trigger if exists properties_set_audit_columns on properties;
create trigger properties_set_audit_columns before update on properties
  for each row execute function set_audit_columns();

drop trigger if exists properties_near_signing_set_audit_columns on properties_near_signing;
create trigger properties_near_signing_set_audit_columns before update on properties_near_signing
  for each row execute function set_audit_columns();

drop trigger if exists flagged_documents_set_updated_at on flagged_documents;
drop trigger if exists flagged_documents_set_audit_columns on flagged_documents;
create trigger flagged_documents_set_audit_columns before update on flagged_documents
  for each row execute function set_audit_columns();

drop trigger if exists recurring_task_completions_set_updated_by on recurring_task_completions;
create trigger recurring_task_completions_set_updated_by before update on recurring_task_completions
  for each row execute function set_updated_by();

drop trigger if exists recurring_task_assignees_set_updated_at on recurring_task_assignees;
drop trigger if exists recurring_task_assignees_set_audit_columns on recurring_task_assignees;
create trigger recurring_task_assignees_set_audit_columns before update on recurring_task_assignees
  for each row execute function set_audit_columns();

drop trigger if exists app_settings_set_updated_at on app_settings;
drop trigger if exists app_settings_set_audit_columns on app_settings;
create trigger app_settings_set_audit_columns before update on app_settings
  for each row execute function set_audit_columns();

-- ----------------------------------------------------------------------------
-- 4. Replace the permissive RLS policies with authenticated-only ones
-- ----------------------------------------------------------------------------
drop policy if exists "Allow full access" on cars;
drop policy if exists "Authenticated users only" on cars;
create policy "Authenticated users only" on cars for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on documents;
drop policy if exists "Authenticated users only" on documents;
create policy "Authenticated users only" on documents for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on properties;
drop policy if exists "Authenticated users only" on properties;
create policy "Authenticated users only" on properties for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on daily_excellence_log;
drop policy if exists "Authenticated users only" on daily_excellence_log;
create policy "Authenticated users only" on daily_excellence_log for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on signing_appointments;
drop policy if exists "Authenticated users only" on signing_appointments;
create policy "Authenticated users only" on signing_appointments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on documents_ready_to_schedule;
drop policy if exists "Authenticated users only" on documents_ready_to_schedule;
create policy "Authenticated users only" on documents_ready_to_schedule for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on properties_near_signing;
drop policy if exists "Authenticated users only" on properties_near_signing;
create policy "Authenticated users only" on properties_near_signing for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on flagged_documents;
drop policy if exists "Authenticated users only" on flagged_documents;
create policy "Authenticated users only" on flagged_documents for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on recurring_task_completions;
drop policy if exists "Authenticated users only" on recurring_task_completions;
create policy "Authenticated users only" on recurring_task_completions for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on recurring_task_assignees;
drop policy if exists "Authenticated users only" on recurring_task_assignees;
create policy "Authenticated users only" on recurring_task_assignees for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow full access" on app_settings;
drop policy if exists "Authenticated users only" on app_settings;
create policy "Authenticated users only" on app_settings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
