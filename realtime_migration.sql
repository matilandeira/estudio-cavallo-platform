-- ============================================================================
-- Estudio Cavallo — Realtime migration
--
-- Run this ONCE against a live project that already has schema.sql (and
-- auth_and_rls_migration.sql, if it predates auth) applied. It adds the 8
-- tables the UI keeps live to the `supabase_realtime` publication so
-- src/hooks/useSupabaseCollection.js's postgres_changes subscriptions
-- actually receive events — RLS being enabled does NOT do this on its own.
--
-- Safe to re-run: skips any table that's already in the publication instead
-- of erroring.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'cars',
    'documents',
    'properties',
    'daily_excellence_log',
    'signing_appointments',
    'documents_ready_to_schedule',
    'properties_near_signing',
    'flagged_documents'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
