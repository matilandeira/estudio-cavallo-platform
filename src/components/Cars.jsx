import React, { useEffect, useRef, useState } from "react";
import { C } from "../lib/theme.jsx";
import { STAFF, CAR_CASE_TYPES, CAR_STATUSES, byPriority } from "../lib/constants.js";
import { todayISO } from "../lib/format.js";
import { sanitizeForSupabase } from "../lib/sanitizePayload.js";
import { isCarCompleted, whatsappLinkCarDocsReady, whatsappLinkCoordinateSigning, whatsappLinkRequestDocumentation } from "../lib/businessLogic.js";
import { label as translate, CASE_TYPE_LABELS, CAR_STATUS_LABELS } from "../lib/labels.js";
import { Header, AddPanel, Field, FilterBar, AssigneesPicker, PriorityPicker, TriStatus, TriLegend, assigneeMatches, DeleteButton, OverdueBadge } from "./SharedUI.jsx";

const blankCar = () => ({
  case_date: todayISO(), client: "", phone: "", financed: false, plate_number: "", registry_number: "", make_model: "",
  plate_number_2: "", registry_number_2: "", make_model_2: "", case_type: CAR_CASE_TYPES[0],
  assignees: ["Alex", "Belén"], notarization_assignees: [],
  lien_status: "not_requested", seizure_status: "not_requested", debt_status: "not_requested",
  sucive_certificate_status: "not_requested", required_plates_status: "not_requested",
  document_drafted_status: "not_requested", paid_status: "not_requested",
  status: "Pending", registry_filing_number: "", pin: "", reminder_date: "", priority: "", notes: "",
  completed_at: null, ready_to_schedule: false,
});
const allGreen = (c) => [c.lien_status, c.seizure_status, c.debt_status, c.sucive_certificate_status, c.required_plates_status, c.document_drafted_status, c.paid_status].every((v) => v === "ok");

export default function Cars({ cars, documentsReadyToSchedule, simpleMode }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({});
  const [form, setForm] = useState(blankCar());

  const filtered = cars.rows
    .filter((c) => !isCarCompleted(c) && (!filters.status || c.status === filters.status) && (!filters.assignee || assigneeMatches(c.assignees, filters.assignee) || assigneeMatches(c.notarization_assignees, filters.assignee)))
    .sort(byPriority);

  const save = async () => {
    setSaving(true);
    try {
      const payload = sanitizeForSupabase(form);
      payload.case_date = payload.case_date || todayISO(); // case_date is NOT NULL; sanitize alone would null it if cleared
      if (isCarCompleted(payload)) payload.completed_at = todayISO();
      await cars.insertRow(payload);
      setForm(blankCar());
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const update = (id, patch, opts) => {
    const car = cars.rows.find((c) => c.id === id);
    if (!car) return;
    const next = { ...car, ...patch };
    const extra = {};
    const was = isCarCompleted(car), now = isCarCompleted(next);
    if (now && !was) extra.completed_at = todayISO();
    if (!now && was) extra.completed_at = null;
    const earlyStatuses = ["Pending", "In Progress"];
    if (allGreen(next) && !allGreen(car) && earlyStatuses.includes(next.status)) {
      extra.status = "Ready to Sign";
      next.status = "Ready to Sign";
    }
    if (next.status === "Ready to Notarize" && car.status !== "Ready to Notarize" && (!next.notarization_assignees || next.notarization_assignees.length === 0)) {
      extra.notarization_assignees = ["Andrea"];
    }
    cars.updateRow(id, sanitizeForSupabase({ ...patch, ...extra }), opts);
  };
  const remove = (id) => cars.removeRowWithUndo(id);

  /* Keeps "Documentos prontos para agendar" in sync with every car currently
     "Ready to Sign" — reactively, not via a one-way `ready_to_schedule` flag
     set once inside update(). That flag can't tell the difference between
     "already queued" and "was queued once, then the queue entry got
     scheduled/deleted, or the car started life in this status from seed
     data" — any of those leave it stuck true and the car silently never
     reappears, even after re-selecting "Ready to Sign" (this is exactly what
     happened to one car in seed.sql: seeded directly with status "Ready to
     Sign" and ready_to_schedule true, but with no matching queue row).
     Checking live membership instead — every time cars or the queue change,
     including realtime updates from other staff — makes this self-healing. */
  const pendingScheduleInserts = useRef(new Set());
  useEffect(() => {
    const queued = documentsReadyToSchedule.rows || [];
    const missing = cars.rows.filter(
      (c) =>
        c.status === "Ready to Sign" &&
        !pendingScheduleInserts.current.has(c.id) &&
        !queued.some((q) => q.client === c.client && q.description === c.make_model)
    );
    missing.forEach(async (c) => {
      pendingScheduleInserts.current.add(c.id);
      try {
        await documentsReadyToSchedule.insertRow({ client: c.client, description: c.make_model, notes: c.notes || "" });
        if (!c.ready_to_schedule) cars.updateRow(c.id, { ready_to_schedule: true });
      } finally {
        pendingScheduleInserts.current.delete(c.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars.rows, documentsReadyToSchedule.rows]);

  return (
    <div className="ec-fade">
      <Header title="Automotores" subtitle="Registro diario y cuatro controles esenciales." onAdd={() => setAdding(true)} />
      <AddPanel open={adding} onClose={() => setAdding(false)} title="Nuevo trámite de automotor">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          <Field label="Fecha"><input className="ec-input" type="date" value={form.case_date} onChange={(e) => setForm({ ...form, case_date: e.target.value })} /></Field>
          <Field label="Cliente"><input className="ec-input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
          {!simpleMode && (
            <>
              <Field label="Teléfono (WhatsApp)"><input className="ec-input" placeholder="09X XXX XXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Financiado"><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, height: 33 }}><input type="checkbox" checked={form.financed} onChange={(e) => setForm({ ...form, financed: e.target.checked })} /> Sí</label></Field>
            </>
          )}
          <Field label="Matrícula"><input className="ec-input" value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} /></Field>
          <Field label="Padrón"><input className="ec-input" value={form.registry_number} onChange={(e) => setForm({ ...form, registry_number: e.target.value })} /></Field>
          <Field label="Marca y modelo"><input className="ec-input" placeholder="Ej: VW Gol" value={form.make_model} onChange={(e) => setForm({ ...form, make_model: e.target.value })} /></Field>
          <Field label="Tipo"><select className="ec-select" value={form.case_type} onChange={(e) => setForm({ ...form, case_type: e.target.value })}>{CAR_CASE_TYPES.map((t) => <option key={t} value={t}>{translate(CASE_TYPE_LABELS, t)}</option>)}</select></Field>
          {form.case_type === "Trade-in" && (
            <>
              <Field label="Matrícula (2º vehículo)"><input className="ec-input" value={form.plate_number_2} onChange={(e) => setForm({ ...form, plate_number_2: e.target.value })} /></Field>
              <Field label="Padrón (2º vehículo)"><input className="ec-input" value={form.registry_number_2} onChange={(e) => setForm({ ...form, registry_number_2: e.target.value })} /></Field>
              <Field label="Marca y modelo (2º vehículo)"><input className="ec-input" placeholder="Ej: Fiat Cronos" value={form.make_model_2} onChange={(e) => setForm({ ...form, make_model_2: e.target.value })} /></Field>
            </>
          )}
          <Field label="Responsable(s)"><AssigneesPicker value={form.assignees} onChange={(v) => setForm({ ...form, assignees: v })} /></Field>
          <Field label="Estado"><select className="ec-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{CAR_STATUSES.map((t) => <option key={t} value={t}>{translate(CAR_STATUS_LABELS, t)}</option>)}</select></Field>
          <Field label="Observaciones"><input className="ec-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        {!simpleMode && form.case_type === "Sale" && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600, marginBottom: 8 }}>Registro (solo compraventa)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              <Field label="Número de ingreso"><input className="ec-input" value={form.registry_filing_number} onChange={(e) => setForm({ ...form, registry_filing_number: e.target.value })} /></Field>
              <Field label="PIN"><input className="ec-input" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></Field>
            </div>
          </div>
        )}
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar trámite"}</button></div>
      </AddPanel>

      <FilterBar filters={filters} setFilters={setFilters} options={[
        { key: "status", label: "Estado", values: CAR_STATUSES.filter((s) => s !== "Notarized"), labelFor: (v) => translate(CAR_STATUS_LABELS, v) },
        { key: "assignee", label: "Responsable", values: STAFF },
      ]} />

      {!simpleMode && <TriLegend />}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.length === 0 && <div className="ec-card" style={{ padding: 24, textAlign: "center", color: C.muted }}>No hay autos registrados todavía.</div>}
        {filtered.map((a) => {
          const dueReminder = a.status === "Pending" && a.reminder_date && a.reminder_date <= todayISO();
          return (
          <div key={a.id} className="ec-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flex: 1, minWidth: 260 }}>
                <input className="ec-input" style={{ width: 150, fontWeight: 700 }} placeholder="Cliente" value={a.client || ""} onChange={(e) => update(a.id, { client: e.target.value }, { debounce: true })} />
                <input className="ec-input" style={{ width: 140 }} placeholder="Marca y modelo" value={a.make_model || ""} onChange={(e) => update(a.id, { make_model: e.target.value }, { debounce: true })} />
                {a.financed && <span className="ec-badge" style={{ background: C.paper2, color: C.wax }}>Financiado</span>}
                {dueReminder && <OverdueBadge />}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="ec-select" style={{ width: "auto" }} value={a.status} onChange={(e) => update(a.id, { status: e.target.value })}>
                  {CAR_STATUSES.map((s) => <option key={s} value={s}>{translate(CAR_STATUS_LABELS, s)}</option>)}
                </select>
                <DeleteButton onConfirm={() => remove(a.id)} />
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>{translate(CASE_TYPE_LABELS, a.case_type)}</span>
              <Field label="Matrícula"><input className="ec-input" style={{ width: 110 }} value={a.plate_number || ""} onChange={(e) => update(a.id, { plate_number: e.target.value }, { debounce: true })} /></Field>
              <Field label="Padrón"><input className="ec-input" style={{ width: 100 }} value={a.registry_number || ""} onChange={(e) => update(a.id, { registry_number: e.target.value }, { debounce: true })} /></Field>
              <Field label="Teléfono"><input className="ec-input" style={{ width: 130 }} value={a.phone || ""} onChange={(e) => update(a.id, { phone: e.target.value }, { debounce: true })} /></Field>
              <span className="ec-mono" style={{ fontSize: 12, color: C.muted }}>{a.case_date}</span>
              <AssigneesPicker value={a.assignees} onChange={(v) => update(a.id, { assignees: v })} />
            </div>
            {a.case_type === "Trade-in" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}`, alignItems: "center" }}>
                <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600 }}>2º vehículo</span>
                <Field label="Matrícula"><input className="ec-input" style={{ width: 110 }} value={a.plate_number_2 || ""} onChange={(e) => update(a.id, { plate_number_2: e.target.value }, { debounce: true })} /></Field>
                <Field label="Padrón"><input className="ec-input" style={{ width: 100 }} value={a.registry_number_2 || ""} onChange={(e) => update(a.id, { registry_number_2: e.target.value }, { debounce: true })} /></Field>
                <Field label="Marca y modelo"><input className="ec-input" style={{ width: 140 }} value={a.make_model_2 || ""} onChange={(e) => update(a.id, { make_model_2: e.target.value }, { debounce: true })} /></Field>
              </div>
            )}
            {a.status === "Pending" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <a href={whatsappLinkRequestDocumentation(a)} target="_blank" rel="noreferrer" className="ec-btn" style={{ textDecoration: "none", background: "#2CA043", borderColor: "#2CA043" }}>
                  Pedir documentación por WhatsApp
                </a>
              </div>
            )}
            {a.status === "Returned from Registry" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <a href={whatsappLinkCarDocsReady(a)} target="_blank" rel="noreferrer" className="ec-btn" style={{ textDecoration: "none", background: "#2CA043", borderColor: "#2CA043" }}>
                  Enviar WhatsApp {a.financed ? "(financiado)" : "(prontos)"}
                </a>
              </div>
            )}
            {a.status === "Ready to Sign" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <a href={whatsappLinkCoordinateSigning(a)} target="_blank" rel="noreferrer" className="ec-btn" style={{ textDecoration: "none", background: "#2CA043", borderColor: "#2CA043" }}>
                  Coordinar firma por WhatsApp
                </a>
              </div>
            )}
            {!simpleMode && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.lien_status} onChange={(v) => update(a.id, { lien_status: v })} /> Libre de prenda</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.seizure_status} onChange={(v) => update(a.id, { seizure_status: v })} /> Libre de embargo</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.debt_status} onChange={(v) => update(a.id, { debt_status: v })} /> Libre de deuda</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.sucive_certificate_status} onChange={(v) => update(a.id, { sucive_certificate_status: v })} /> Cert. Sucive</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.required_plates_status} onChange={(v) => update(a.id, { required_plates_status: v })} /> Matrículas req.</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.document_drafted_status} onChange={(v) => update(a.id, { document_drafted_status: v })} /> Doc. elaborado</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.paid_status} onChange={(v) => update(a.id, { paid_status: v })} /> Cobrado</label>
              </div>
            )}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
              <Field label="Observaciones — qué está faltando"><input className="ec-input" placeholder="Ej: falta cédula del cónyuge" value={a.notes || ""} onChange={(e) => update(a.id, { notes: e.target.value }, { debounce: true })} /></Field>
            </div>
            {!simpleMode && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}`, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Reasignar para protocolización:</span>
                  <AssigneesPicker value={a.notarization_assignees} onChange={(v) => update(a.id, { notarization_assignees: v })} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span style={{ color: dueReminder ? C.wax : C.muted, fontWeight: dueReminder ? 700 : 400 }}>Recordarme el:</span>
                  <input className="ec-input" style={{ width: 140 }} type="date" value={a.reminder_date || ""} onChange={(e) => update(a.id, { reminder_date: e.target.value })} />
                  {dueReminder && <OverdueBadge />}
                </label>
                <PriorityPicker value={a.priority} onChange={(v) => update(a.id, { priority: v })} />
              </div>
            )}
            {!simpleMode && a.case_type === "Sale" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600, marginBottom: 8 }}>Registro</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  <Field label="Número de ingreso"><input className="ec-input" value={a.registry_filing_number || ""} onChange={(e) => update(a.id, { registry_filing_number: e.target.value }, { debounce: true })} /></Field>
                  <Field label="PIN"><input className="ec-input" value={a.pin || ""} onChange={(e) => update(a.id, { pin: e.target.value }, { debounce: true })} /></Field>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
