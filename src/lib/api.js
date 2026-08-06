import { supabase } from "./supabaseClient.js";

/* Generic Supabase CRUD helpers for a single table. Every table has a uuid
   primary key named "id", so insert/update/remove can share this shape.
   `table` is exposed on the returned object so callers (useSupabaseCollection)
   can subscribe to postgres_changes for the same table without repeating its
   name at every call site. */
export function createTableApi(table, { orderBy = "created_at", ascending = false } = {}) {
  return {
    table,
    async list() {
      const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending });
      if (error) throw error;
      return data;
    },
    async insert(row) {
      const { data, error } = await supabase.from(table).insert(row).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, patch) {
      const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
  };
}

export const carsApi = createTableApi("cars");
export const documentsApi = createTableApi("documents");
export const propertiesApi = createTableApi("properties");
export const dailyExcellenceLogApi = createTableApi("daily_excellence_log", { orderBy: "log_date" });
export const signingAppointmentsApi = createTableApi("signing_appointments", { orderBy: "appointment_date", ascending: true });
export const documentsReadyToScheduleApi = createTableApi("documents_ready_to_schedule", { orderBy: "created_at", ascending: true });
export const propertiesNearSigningApi = createTableApi("properties_near_signing", { orderBy: "created_at", ascending: true });
export const flaggedDocumentsApi = createTableApi("flagged_documents");

export const recurringTaskCompletionsApi = {
  async list() {
    const { data, error } = await supabase.from("recurring_task_completions").select("*");
    if (error) throw error;
    return data;
  },
  async setCompleted(taskId, periodKey) {
    const { data, error } = await supabase
      .from("recurring_task_completions")
      .upsert({ task_id: taskId, period_key: periodKey, completed_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async clear(taskId) {
    const { error } = await supabase.from("recurring_task_completions").delete().eq("task_id", taskId);
    if (error) throw error;
  },
};

export const recurringTaskAssigneesApi = {
  async list() {
    const { data, error } = await supabase.from("recurring_task_assignees").select("*");
    if (error) throw error;
    return data;
  },
  async set(taskId, assignees) {
    const { data, error } = await supabase
      .from("recurring_task_assignees")
      .upsert({ task_id: taskId, assignees })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export const appSettingsApi = {
  /* maybeSingle (not single): if the settings row isn't visible yet — no
     session, RLS still filtering, or the seed row is simply missing — this
     resolves with `null` instead of throwing a "0 rows" coercion error. */
  async get() {
    const { data, error } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw error;
    return data;
  },
  async setSimpleMode(simpleMode) {
    const { data, error } = await supabase
      .from("app_settings")
      .update({ simple_mode: simpleMode })
      .eq("id", true)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
