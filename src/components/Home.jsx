import React, { useMemo, useState } from "react";
import { Bell, Car, ClipboardList, FileText, AlertTriangle, ChevronRight, Plus } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { STAFF, computeScore } from "../lib/constants.js";
import { todayISO, startOfWeekISO, fmtDate, isOverdue, isUrgent } from "../lib/format.js";
import { sanitizeForSupabase } from "../lib/sanitizePayload.js";
import {
  isCarCompleted, isDocumentCompleted, isPropertyCompleted, carInEarlyStage, documentInEarlyStage,
  computeAutomaticTotals,
} from "../lib/businessLogic.js";
import { label as translate, CAR_STATUS_LABELS, DOCUMENT_TYPE_LABELS, CASE_TYPE_LABELS, ORIGIN_LABELS, documentStatusLabelEs } from "../lib/labels.js";
import { AddPanel, Field, StatusBadge, Seal, assigneesLabel, Check, DeleteButton, OverdueBadge, UrgentFilterToggle, useRowHighlight } from "./SharedUI.jsx";

/* ============================== TAB: HOME ============================== */
export default function Home({
  cars, documents, properties, dailyExcellenceLog,
  signingAppointments, documentsReadyToSchedule, propertiesNearSigning, flaggedDocuments,
  setTab, setWorkInitialFilters, recurringTasks, highlightId,
}) {
  const today = todayISO();
  const carRows = cars.rows, docRows = documents.rows, propRows = properties.rows;
  const [remindersUrgentOnly, setRemindersUrgentOnly] = useState(false);

  const kpis = useMemo(() => {
    const weekStart = startOfWeekISO();
    const carsThisWeek = carRows.filter((c) => c.case_date >= weekStart).length;
    const carsCompletedThisWeek = carRows.filter((c) => isCarCompleted(c) && c.completed_at && c.completed_at >= weekStart).length;
    const carsPending = carRows.filter((c) => !isCarCompleted(c)).length;
    const docsPending = docRows.filter((d) => !isDocumentCompleted(d)).length;
    const propertiesActive = propRows.filter((p) => !isPropertyCompleted(p)).length;
    const activeWork = carsPending + docsPending + propertiesActive;
    const carsReadyToSign = carRows.filter((c) => c.status === "Ready to Sign").length;
    const docsForReview = docRows.filter((d) => d.status === "For Review").length;
    const overdue = [
      ...docRows.filter((d) => isOverdue(d.reminder_date, d.status)),
      ...propRows.filter((p) => isOverdue(p.reminder_date, p.status)),
    ].length;
    const inProgressItems = [
      ...carRows.filter(carInEarlyStage).map((c) => ({ key: "car-" + c.id, client: c.client, type: "Auto", status: c.status, statusLabel: translate(CAR_STATUS_LABELS, c.status), assignee: assigneesLabel(c.assignees), registryNumber: c.registry_number, makeModel: c.make_model, tab: "cars" })),
      ...docRows.filter(documentInEarlyStage).map((d) => ({ key: "doc-" + d.id, client: d.client, type: translate(DOCUMENT_TYPE_LABELS, d.document_type), status: null, statusLabel: documentStatusLabelEs(d), assignee: assigneesLabel(d.assignees), registryNumber: "", makeModel: "", tab: "documents" })),
    ].sort((p, q) => p.client?.localeCompare(q.client || "") || 0);
    // Base reminders: due today or overdue (unchanged default view). The "⚡
    // Urgentes" toggle below swaps this for remindersWeek, which also pulls
    // in anything due in the next 7 days — see isUrgent() in lib/format.js.
    const reminders = [
      ...carRows.filter((c) => c.reminder_date && c.reminder_date <= today).map((c) => ({ key: "car-" + c.id, client: c.client, origin: "Auto", detail: c.make_model || translate(CASE_TYPE_LABELS, c.case_type), date: c.reminder_date, tab: "cars", rawId: c.id })),
      ...docRows.filter((d) => d.reminder_date && d.reminder_date <= today).map((d) => ({ key: "doc-" + d.id, client: d.client, origin: "Documento", detail: translate(DOCUMENT_TYPE_LABELS, d.document_type), date: d.reminder_date, tab: "documents", rawId: d.id })),
      ...propRows.filter((p) => p.reminder_date && p.reminder_date <= today).map((p) => ({ key: "prop-" + p.id, client: p.client, origin: "Inmueble", detail: `Padrón ${p.registry_number || "—"}`, date: p.reminder_date, tab: "properties", rawId: p.id })),
    ].sort((p, q) => (p.date || "").localeCompare(q.date || ""));
    const remindersWeek = [
      ...carRows.filter((c) => isUrgent(c.reminder_date, c.status)).map((c) => ({ key: "car-" + c.id, client: c.client, origin: "Auto", detail: c.make_model || translate(CASE_TYPE_LABELS, c.case_type), date: c.reminder_date, tab: "cars", rawId: c.id })),
      ...docRows.filter((d) => isUrgent(d.reminder_date, d.status)).map((d) => ({ key: "doc-" + d.id, client: d.client, origin: "Documento", detail: translate(DOCUMENT_TYPE_LABELS, d.document_type), date: d.reminder_date, tab: "documents", rawId: d.id })),
      ...propRows.filter((p) => isUrgent(p.reminder_date, p.status)).map((p) => ({ key: "prop-" + p.id, client: p.client, origin: "Inmueble", detail: `Padrón ${p.registry_number || "—"}`, date: p.reminder_date, tab: "properties", rawId: p.id })),
    ].sort((p, q) => (p.date || "").localeCompare(q.date || ""));
    return { carsThisWeek, carsCompletedThisWeek, carsPending, docsPending, propertiesActive, activeWork, carsReadyToSign, docsForReview, overdue, inProgressItems, reminders, remindersWeek };
  }, [carRows, docRows, propRows, today]);

  const highPriorityCount = carRows.filter((c) => c.priority === "High").length + docRows.filter((d) => d.priority === "High").length + propRows.filter((p) => p.priority === "High").length;
  const viewHighPriority = () => { setWorkInitialFilters({ priority: "High" }); setTab("work"); };

  const totals = useMemo(() => {
    const t = { properties: 0, notarizations: 0, probates: 0, reviews: 0, certificates: 0, salesChecked: 0, salesFlagged: 0, negativeReviews: 0, flaggedCertificates: 0 };
    const ym = today.slice(0, 7);
    dailyExcellenceLog.rows.filter((e) => e.log_date?.slice(0, 7) === ym).forEach((e) => {
      t.reviews += Number(e.google_reviews || 0);
      t.negativeReviews += Number(e.negative_reviews || 0);
    });
    const auto = computeAutomaticTotals(carRows, docRows, propRows, flaggedDocuments.rows, ym);
    t.properties += auto.properties; t.notarizations += auto.notarizations; t.probates += auto.probates; t.certificates += auto.certificates;
    t.salesChecked += auto.salesChecked; t.salesFlagged += auto.salesFlagged; t.flaggedCertificates += auto.flaggedCertificates;
    return t;
  }, [dailyExcellenceLog.rows, carRows, docRows, propRows, flaggedDocuments.rows, today]);
  const score = computeScore(totals);

  const cards = [
    { label: "Autos ingresados esta semana", value: kpis.carsThisWeek, icon: Car, tab: "cars" },
    { label: "Autos finalizados esta semana", value: kpis.carsCompletedThisWeek, icon: Car, tab: "work" },
    { label: "Trabajos activos (Autos+Doc.+Inm.)", value: kpis.activeWork, icon: ClipboardList, tab: "work" },
    { label: "Autos prontos para firma", value: kpis.carsReadyToSign, icon: Car, tab: "cars" },
    { label: "Documentos para revisión", value: kpis.docsForReview, icon: FileText, tab: "documents" },
    { label: "Seguimientos vencidos", value: kpis.overdue, icon: AlertTriangle, tab: "documents", danger: true },
  ];

  return (
    <div className="ec-fade">
      <div className="ec-dashboard-grid" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="ec-card" style={{ padding: "6px 0" }}>
            <SigningAgenda signingAppointments={signingAppointments} highlightId={highlightId} />
          </div>
          <div className="ec-card" style={{ padding: "6px 0" }}>
            <ReadyToSchedule documentsReadyToSchedule={documentsReadyToSchedule} signingAppointments={signingAppointments} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            {cards.map((c) => (
              <button key={c.label} onClick={() => setTab(c.tab)} className="ec-card" style={{ textAlign: "left", padding: "14px 16px", cursor: "pointer", borderColor: c.danger && c.value > 0 ? C.wax : C.line }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <c.icon size={16} color={c.danger && c.value > 0 ? C.wax : C.brass} />
                </div>
                <div className="ec-serif" style={{ fontSize: 26, fontWeight: 700, marginTop: 6, color: c.danger && c.value > 0 ? C.wax : C.ink }}>{c.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{c.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="ec-card" style={{ padding: "6px 0" }}>
            <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Autos y documentos en trámite</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {highPriorityCount > 0 && (
                  <button onClick={viewHighPriority} className="ec-badge" style={{ background: "#F3DDE0", color: C.wax, cursor: "pointer", border: "none", fontWeight: 700 }}>
                    ⚠ {highPriorityCount} prioridad alta
                  </button>
                )}
                <span style={{ fontSize: 12, color: C.muted }}>{kpis.inProgressItems.length} en curso</span>
              </div>
            </div>
            <div className="ec-scroll ec-hide-mobile" style={{ maxHeight: 300, overflowY: "auto" }}>
              <table className="ec-table">
                <thead><tr><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Responsable</th><th>Padrón</th><th>Marca y modelo</th></tr></thead>
                <tbody>
                  {kpis.inProgressItems.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: C.muted, padding: 20 }}>No hay trabajos pendientes o en curso</td></tr>}
                  {kpis.inProgressItems.map((it) => (
                    <tr key={it.key} onClick={() => setTab(it.tab)} style={{ cursor: "pointer" }}>
                      <td>{it.client || "—"}</td><td>{it.type}</td>
                      <td><StatusBadge status={it.status} label={it.statusLabel} /></td><td>{it.assignee}</td>
                      <td>{it.registryNumber || "—"}</td><td>{it.makeModel || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ec-scroll ec-hide-desktop" style={{ maxHeight: 340, overflowY: "auto" }}>
              {kpis.inProgressItems.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 20, fontSize: 13 }}>No hay trabajos pendientes o en curso</div>}
              {kpis.inProgressItems.map((it) => (
                <div key={it.key} className="ec-mobile-item" onClick={() => setTab(it.tab)} style={{ cursor: "pointer" }}>
                  <div className="ec-mobile-item-row">
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{it.client || "—"}</span>
                    <StatusBadge status={it.status} label={it.statusLabel} />
                  </div>
                  <div style={{ fontSize: 13, color: C.muted }}>{it.type}</div>
                  <div className="ec-mobile-item-row">
                    <span>{it.assignee}</span>
                    <span>{it.registryNumber || it.makeModel || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ec-card" style={{ padding: "6px 0" }}>
            <PropertiesNearSigning properties={properties} propertiesNearSigning={propertiesNearSigning} setTab={setTab} />
          </div>

          <div className="ec-card" style={{ padding: "6px 0" }}>
            <UnifiedReminders
              reminders={remindersUrgentOnly ? kpis.remindersWeek : kpis.reminders}
              setTab={setTab}
              urgentOnly={remindersUrgentOnly}
              setUrgentOnly={setRemindersUrgentOnly}
              weekCount={kpis.remindersWeek.length}
            />
          </div>
        </div>
      </div>

      <div className="ec-card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
        <Seal level={score.level} size={90} />
        <div>
          <div className="ec-mono" style={{ fontSize: 20, fontWeight: 600 }}>{score.total} pts</div>
          <button className="ec-btn-ghost" onClick={() => setTab("excellence")} style={{ marginTop: 4 }}>Ver excelencia operativa <ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="ec-card" style={{ padding: "6px 0" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}` }}>
          <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Tareas recurrentes</span>
        </div>
        <RecurringTasksPanel recurringTasks={recurringTasks} />
      </div>
    </div>
  );
}

/* Reminders due today or overdue by default; the "⚡ Urgentes" toggle swaps
   in the wider 7-day window (see kpis.remindersWeek in Home() above),
   combining Cars + Documents + Properties in one place either way. */
function UnifiedReminders({ reminders, setTab, urgentOnly, setUrgentOnly, weekCount }) {
  const today = todayISO();
  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}><Bell size={15} color={C.brass} /> Recordatorios</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UrgentFilterToggle active={urgentOnly} onChange={setUrgentOnly} count={urgentOnly ? undefined : weekCount} />
          <span style={{ fontSize: 12, color: C.muted }}>{reminders.length}</span>
        </div>
      </div>
      <div>
        {reminders.length === 0 && <div style={{ padding: "20px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>No hay recordatorios pendientes.</div>}
        {reminders.map((r) => {
          const overdue = r.date < today;
          return (
            <div key={r.key} onClick={() => setTab(r.tab)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, cursor: "pointer", borderLeft: overdue ? `3px solid ${C.wax}` : "3px solid transparent" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.client || "Cliente sin nombre"}</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{r.origin} · {r.detail || "—"}</div>
              </div>
              {overdue && <OverdueBadge />}
              <span style={{ fontSize: 12, color: overdue ? C.wax : C.muted, fontWeight: overdue ? 700 : 400 }}>{fmtDate(r.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SigningAgenda({ signingAppointments, highlightId }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const blank = () => ({ appointment_date: todayISO(), appointment_time: "10:00", origin: "Car", client: "", description: "", notes: "" });
  const [form, setForm] = useState(blank());
  const activeHighlight = useRowHighlight(highlightId);

  const save = async () => {
    // appointment_date is NOT NULL with no sensible default (unlike case_date
    // etc., there's no "today" to fall back to for a specific signing day),
    // so a missing one has to block the save rather than get sanitized away.
    if (!form.appointment_date) return;
    setSaving(true);
    try {
      const payload = sanitizeForSupabase(form);
      payload.appointment_time = payload.appointment_time || "10:00"; // NOT NULL with a DB default; keep it in sync client-side too
      await signingAppointments.insertRow(payload);
      setForm(blank());
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };
  const remove = (id) => signingAppointments.removeRowWithUndo(id, { message: "Firma eliminada · Deshacer" });

  const today = todayISO();
  const upcoming = signingAppointments.rows
    .filter((a) => a.appointment_date >= today)
    .sort((a, b) => (a.appointment_date === b.appointment_date ? (a.appointment_time || "").localeCompare(b.appointment_time || "") : a.appointment_date.localeCompare(b.appointment_date)));

  const groups = [];
  upcoming.forEach((a) => {
    const last = groups[groups.length - 1];
    if (last && last.appointment_date === a.appointment_date) last.items.push(a);
    else groups.push({ appointment_date: a.appointment_date, items: [a] });
  });

  const weekdayLong = (d) => new Date(d + "T00:00:00").toLocaleDateString("es-UY", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Agenda de firmas</span>
        <button className="ec-btn-ghost" onClick={() => setAdding(true)}><Plus size={13} /> Agendar</button>
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} onSubmit={save} title="Nueva firma">
        <div className="ec-form-grid">
          <Field label="Día"><input className="ec-input" type="date" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} /></Field>
          <Field label="Hora"><input className="ec-input" type="time" value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} /></Field>
          <Field label="Tipo"><select className="ec-select" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}><option value="Car">Auto</option><option value="Property">Inmueble</option></select></Field>
          <Field label="Cliente"><input className="ec-input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
          <Field label={form.origin === "Property" ? "Padrón" : "Marca y modelo"}><input className="ec-input" placeholder={form.origin === "Property" ? "Ej: Padrón 12345" : "Ej: VW Gol"} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Observaciones"><input className="ec-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save} disabled={saving}><Plus size={14} /> {saving ? "Guardando…" : "Agendar firma"}</button></div>
      </AddPanel>

      <div style={{ padding: "4px 0 8px" }}>
        {groups.length === 0 && <div style={{ padding: "20px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>No hay firmas agendadas.</div>}
        {groups.map((g) => (
          <div key={g.appointment_date} style={{ padding: "8px 16px" }}>
            <div className="ec-mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: C.brass, fontWeight: 600, marginBottom: 4, paddingTop: 4, borderTop: g.appointment_date === today ? "none" : `1px dashed ${C.line}` }}>
              {g.appointment_date === today ? "Hoy" : weekdayLong(g.appointment_date)}
            </div>
            {g.items.map((a) => (
              <div key={a.id} id={`row-${a.id}`} className={activeHighlight === a.id ? "ec-highlight" : ""} style={{ display: "flex", alignItems: "center", gap: 14, padding: "6px 0", fontSize: 13, borderRadius: 4 }}>
                <span className="ec-mono" style={{ width: 48, color: C.ink, fontWeight: 600 }}>{(a.appointment_time || "—").slice(0, 5)}</span>
                <span style={{ width: 130, flexShrink: 0 }}>{a.client || "—"}</span>
                <span className="ec-badge" style={{ background: C.paper2, color: a.origin === "Property" ? C.bottle : C.brass, flexShrink: 0 }}>{translate(ORIGIN_LABELS, a.origin) || "Auto"}</span>
                <span style={{ width: 130, flexShrink: 0, color: C.muted }}>{a.description || "—"}</span>
                <span style={{ flex: 1, color: C.muted, fontSize: 12.5 }}>{a.notes || ""}</span>
                <DeleteButton onConfirm={() => remove(a.id)} size={13} confirmText="¿Eliminar esta firma agendada?" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Manual-entry queue: client, vehicle and notes. Once a date (and time) is set and confirmed,
   the record moves to the Signing agenda and leaves this list. */
function ReadyToSchedule({ documentsReadyToSchedule, signingAppointments }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const blank = () => ({ client: "", description: "", notes: "" });
  const [form, setForm] = useState(blank());
  const [drafts, setDrafts] = useState({});

  const save = async () => {
    setSaving(true);
    try {
      await documentsReadyToSchedule.insertRow({ ...form });
      setForm(blank());
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };
  const remove = (id) => documentsReadyToSchedule.removeRowWithUndo(id, { message: "Quitado de prontos para agendar · Deshacer" });

  const draftFor = (id) => drafts[id] || { date: "", time: "10:00" };
  const setDraft = (id, patch) => setDrafts({ ...drafts, [id]: { ...draftFor(id), ...patch } });

  const schedule = async (p) => {
    const draft = draftFor(p.id);
    if (!draft.date) return;
    await signingAppointments.insertRow(sanitizeForSupabase({
      appointment_date: draft.date, appointment_time: draft.time || "10:00", origin: "Car",
      client: p.client, description: p.description, notes: p.notes || "",
    }));
    // Not a user delete — the record just moved to the Signing agenda, so
    // this must remove it immediately, not through the confirm/undo flow
    // (which would otherwise let "Deshacer" resurrect a now-duplicate entry).
    documentsReadyToSchedule.removeRow(p.id);
  };

  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Documentos prontos para agendar</span>
        <button className="ec-btn-ghost" onClick={() => setAdding(true)}><Plus size={13} /> Agregar</button>
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} onSubmit={save} title="Nuevo documento pronto">
        <div className="ec-form-grid">
          <Field label="Cliente"><input className="ec-input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
          <Field label="Auto"><input className="ec-input" placeholder="Ej: VW Gol" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Observaciones"><input className="ec-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save} disabled={saving}><Plus size={14} /> {saving ? "Guardando…" : "Agregar"}</button></div>
      </AddPanel>

      <div>
        {documentsReadyToSchedule.rows.length === 0 && <div style={{ padding: "20px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>No hay documentos prontos sin agendar.</div>}
        {documentsReadyToSchedule.rows.map((p) => {
          const draft = draftFor(p.id);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.client || "Cliente sin nombre"}</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{p.description || "—"}{p.notes ? ` · ${p.notes}` : ""}</div>
              </div>
              <input className="ec-input" style={{ width: 130 }} type="date" value={draft.date} onChange={(e) => setDraft(p.id, { date: e.target.value })} />
              <input className="ec-input" style={{ width: 90 }} type="time" value={draft.time} onChange={(e) => setDraft(p.id, { time: e.target.value })} />
              <button className="ec-btn" onClick={() => schedule(p)}><Plus size={13} /> Agendar</button>
              <DeleteButton onConfirm={() => remove(p.id)} confirmText="¿Eliminar este documento pronto?" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Properties about to sign: picked from the Properties list, with a note of what's missing */
function PropertiesNearSigning({ properties, propertiesNearSigning, setTab }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const blank = () => ({ propertyId: "", missing_items: "" });
  const [form, setForm] = useState(blank());

  const save = async () => {
    const prop = properties.rows.find((p) => p.id === form.propertyId);
    if (!prop) return;
    setSaving(true);
    try {
      await propertiesNearSigning.insertRow({ property_id: prop.id, client: prop.client, registry_number: prop.registry_number, missing_items: form.missing_items });
      setForm(blank());
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };
  const remove = (id) => propertiesNearSigning.removeRowWithUndo(id, { message: "Quitado de la lista · Deshacer" });
  const setMissingItems = (id, val) => propertiesNearSigning.updateRow(id, { missing_items: val }, { debounce: true });

  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Inmuebles próximos a firmarse</span>
        <button className="ec-btn-ghost" onClick={() => setAdding(true)}><Plus size={13} /> Agregar</button>
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} onSubmit={save} title="Agregar inmueble próximo a firmarse">
        <div className="ec-form-grid">
          <Field label="Inmueble">
            <select className="ec-select" value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
              <option value="">Elegir…</option>
              {properties.rows.map((p) => <option key={p.id} value={p.id}>{p.client || "Sin cliente"} · Padrón {p.registry_number || "—"}</option>)}
            </select>
          </Field>
          <Field label="Qué está faltando"><input className="ec-input" value={form.missing_items} onChange={(e) => setForm({ ...form, missing_items: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save} disabled={saving}><Plus size={14} /> {saving ? "Guardando…" : "Agregar"}</button></div>
      </AddPanel>

      <div>
        {propertiesNearSigning.rows.length === 0 && <div style={{ padding: "20px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>No hay inmuebles próximos a firmarse.</div>}
        {propertiesNearSigning.rows.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140, cursor: "pointer" }} onClick={() => setTab("properties")}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.client || "Cliente sin nombre"}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>Padrón {p.registry_number || "—"}</div>
            </div>
            <input className="ec-input" style={{ width: 220 }} placeholder="Qué está faltando" value={p.missing_items || ""} onChange={(e) => setMissingItems(p.id, e.target.value)} />
            <DeleteButton onConfirm={() => remove(p.id)} confirmText="¿Quitar este inmueble de la lista?" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecurringTasksPanel({ recurringTasks }) {
  const { tasks, isDone, toggle, assigneesFor, setAssignees } = recurringTasks;
  const freqLabel = { daily: "Diaria", weekly: "Semanal", monthly: "Mensual" };
  const freqColor = { daily: C.bottle, weekly: C.brass, monthly: C.wax };

  return (
    <div>
      {tasks.map((t) => {
        const done = isDone(t);
        return (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
            <Check checked={done} onChange={() => toggle(t)} />
            <div style={{ flex: 1, fontSize: 13, textDecoration: done ? "line-through" : "none", color: done ? C.muted : C.ink, minWidth: 180 }}>{t.title}</div>
            <span className="ec-badge" style={{ background: C.paper2, color: freqColor[t.freq] }}>{freqLabel[t.freq]}</span>
            <AssigneesPickerInline value={assigneesFor(t)} onChange={(v) => setAssignees(t.id, v)} />
          </div>
        );
      })}
    </div>
  );
}

function AssigneesPickerInline({ value, onChange }) {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  const options = [...STAFF, "Todos"];
  const toggle = (name) => onChange(list.includes(name) ? list.filter((v) => v !== name) : [...list, name]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {options.map((name) => (
        <button key={name} type="button" onClick={() => toggle(name)} className={`ec-chip ${list.includes(name) ? "active" : ""}`} style={{ padding: "2px 8px", fontSize: 11 }}>
          {name}
        </button>
      ))}
    </div>
  );
}
