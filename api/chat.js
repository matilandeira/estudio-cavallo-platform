import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/* Vercel Serverless Function backing the AI Chat Assistant
   (src/components/AIChatModal.jsx). Node.js runtime — never bundled into
   the client, so it's the only place that ever sees ANTHROPIC_API_KEY.

   Security notes:
   - Requires a valid Supabase session (the same access token the frontend
     already holds) before doing anything else. Without this, the endpoint
     would be an open proxy to a paid Anthropic key for anyone on the
     internet — auth is what keeps the API bill (and the office's case
     data) from leaking to random callers, not an afterthought.
   - The Supabase client below is created WITH that user's access token, so
     every query it runs is subject to the same Row Level Security policies
     as the browser — this function only ever sees what the signed-in user
     could already see themselves. */

const MODEL = "claude-3-5-haiku-20241022";
const MAX_HISTORY = 20; // caps token usage on long conversations
const MAX_MESSAGE_LENGTH = 4000; // caps a single oversized message

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtList(rows, mapper) {
  return rows && rows.length ? rows.map(mapper).join("\n") : "(ninguno)";
}

/* Compact, plain-text summary of the office's current active work, built
   from a handful of bounded queries — not a full data dump. Keeps the
   prompt small/cheap and grounds Claude's answers in real, current data
   instead of letting it guess. Status filtering here is intentionally
   simple (not the full multi-field completion logic from
   src/lib/businessLogic.js, which is frontend-only and scoring-specific) —
   good enough for a conversational summary, not meant to be exhaustive. */
async function buildContext(supabase) {
  const today = todayISO();
  const in14Days = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const [cars, documents, properties, signings, flagged] = await Promise.all([
    supabase
      .from("cars")
      .select("client, make_model, case_type, status, priority, reminder_date, case_date")
      .neq("status", "Completed").neq("status", "Notarized")
      .order("case_date", { ascending: false }).limit(25),
    supabase
      .from("documents")
      .select("client, document_type, status, priority, reminder_date, case_date")
      .neq("status", "Completed")
      .order("case_date", { ascending: false }).limit(25),
    supabase
      .from("properties")
      .select("client, registry_number, stage, status, priority, reminder_date, case_date")
      .neq("stage", "Completed")
      .order("case_date", { ascending: false }).limit(25),
    supabase
      .from("signing_appointments")
      .select("client, description, origin, appointment_date, appointment_time")
      .gte("appointment_date", today).lte("appointment_date", in14Days)
      .order("appointment_date", { ascending: true }).limit(25),
    supabase
      .from("flagged_documents")
      .select("client, sector, make_model, document_description, status, flagged_date")
      .eq("resolved", false)
      .order("flagged_date", { ascending: false }).limit(20),
  ]);

  const overdue = [...(cars.data || []), ...(documents.data || []), ...(properties.data || [])]
    .filter((r) => r.reminder_date && r.reminder_date < today);

  return `Fecha de hoy: ${today}

AUTOS EN TRÁMITE (no finalizados):
${fmtList(cars.data, (c) => `- ${c.client || "sin nombre"} · ${c.make_model || c.case_type || ""} · estado: ${c.status} · prioridad: ${c.priority || "sin definir"}${c.reminder_date ? ` · recordatorio: ${c.reminder_date}` : ""}`)}

DOCUMENTOS EN TRÁMITE (no finalizados):
${fmtList(documents.data, (d) => `- ${d.client || "sin nombre"} · ${d.document_type} · estado: ${d.status} · prioridad: ${d.priority || "sin definir"}${d.reminder_date ? ` · recordatorio: ${d.reminder_date}` : ""}`)}

INMUEBLES ACTIVOS:
${fmtList(properties.data, (p) => `- ${p.client || "sin nombre"} · Padrón ${p.registry_number || "—"} · etapa: ${p.stage} · prioridad: ${p.priority || "sin definir"}${p.reminder_date ? ` · recordatorio: ${p.reminder_date}` : ""}`)}

FIRMAS AGENDADAS (próximos 14 días):
${fmtList(signings.data, (s) => `- ${s.appointment_date} ${s.appointment_time ? s.appointment_time.slice(0, 5) : ""} · ${s.client || "sin nombre"} · ${s.origin === "Property" ? "Inmueble" : "Auto"} · ${s.description || ""}`)}

TRÁMITES ATRASADOS (recordatorio vencido):
${fmtList(overdue, (r) => `- ${r.client || "sin nombre"} · recordatorio: ${r.reminder_date}`)}

DOCUMENTOS OBSERVADOS SIN RESOLVER:
${fmtList(flagged.data, (f) => `- ${f.client || "sin nombre"} · ${f.sector === "Documents" ? (f.document_description || "documento") : (f.make_model || "vehículo")} · estado: ${f.status} · desde: ${f.flagged_date}`)}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Método no permitido." });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!token || !supabaseUrl || !supabaseAnonKey) {
    res.status(401).json({ error: "UNAUTHENTICATED", message: "Iniciá sesión para usar el asistente." });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) {
    res.status(401).json({ error: "UNAUTHENTICATED", message: "Tu sesión venció. Volvé a iniciar sesión." });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({
      error: "API_KEY_MISSING",
      message: "El chat de IA aún no tiene configurada la API Key en Vercel.",
    });
    return;
  }

  const body = req.body || {};
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Falta el mensaje." });
    return;
  }

  const messages = body.messages
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, MAX_MESSAGE_LENGTH),
    }));

  try {
    const context = await buildContext(supabase);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.3,
      system:
        "Sos el asistente virtual de Estudio Cavallo, un estudio notarial uruguayo. Respondé siempre en español " +
        "rioplatense, de forma clara, concisa y profesional. Basá tus respuestas ÚNICAMENTE en los datos del " +
        "estudio listados a continuación — es un resumen del estado actual, no la base de datos completa. Si no " +
        "tenés datos suficientes para responder con certeza, decilo claramente en vez de inventar. No repitas el " +
        "resumen completo salvo que te lo pidan; respondé la pregunta puntual.\n\n" + context,
      messages,
    });

    const reply = response.content?.find((block) => block.type === "text")?.text || "";
    res.status(200).json({ reply });
  } catch (err) {
    console.error("api/chat error:", err);
    // err.message here is whatever the Anthropic SDK, or the Supabase context
    // queries in buildContext(), actually threw (invalid key, no credit
    // balance, network failure, RLS/query error, etc.) — surfaced verbatim so
    // the widget/console can show the real cause instead of a generic 500.
    res.status(500).json({
      error: "CHAT_ERROR",
      message: "No se pudo obtener respuesta de la IA. Intentá nuevamente en unos segundos.",
      detail: err?.message || String(err),
    });
  }
}
