import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { PRIORITIES, FLAG_STATUSES, SECTORS } from "../lib/constants.js";
import { todayISO, fmtDate } from "../lib/format.js";
import { sanitizeForSupabase } from "../lib/sanitizePayload.js";
import { monthsElapsed } from "../lib/businessLogic.js";
import { label as translate, FLAG_STATUS_LABELS, SECTOR_LABELS, PRIORITY_LABELS, DOCUMENT_TYPE_LABELS } from "../lib/labels.js";
import { AddPanel, Field, PriorityPicker, DeleteButton } from "./SharedUI.jsx";

const blankFlag = () => ({
  flagged_date: todayISO(), sector: SECTORS[0], linked_record_id: "", client: "", registry_number: "",
  make_model: "", registry_filing_number: "", pin: "", document_description: "", objection_details: "",
  status: FLAG_STATUSES[0], priority: "",
});

export default function FlaggedDocuments({ flaggedDocuments, cars, documents }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankFlag());

  const linkToCar = (carId) => {
    const c = (cars || []).find((x) => x.id === carId);
    if (!c) { setForm({ ...form, linked_record_id: "" }); return; }
    setForm({ ...form, linked_record_id: carId, client: c.client, registry_number: c.registry_number, make_model: c.make_model, registry_filing_number: c.registry_filing_number || form.registry_filing_number, pin: c.pin || form.pin });
  };
  const linkToDocument = (docId) => {
    const d = (documents || []).find((x) => x.id === docId);
    if (!d) { setForm({ ...form, linked_record_id: "" }); return; }
    setForm({ ...form, linked_record_id: docId, client: d.client, document_description: d.document_type });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = sanitizeForSupabase(form);
      payload.flagged_date = payload.flagged_date || todayISO(); // flagged_date is NOT NULL; sanitize alone would null it if cleared
      await flaggedDocuments.insertRow(payload);
      setForm(blankFlag());
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };
  const remove = (id) => flaggedDocuments.removeRowWithUndo(id, { message: "Observación eliminada · Deshacer" });
  const setStatus = (id, status) => {
    if (status === "Objection Nearly Resolved" || status === "Objection Cleared" || status === "Completed") {
      flaggedDocuments.updateRow(id, { status, resolved: true, resolved_at: todayISO() });
      return;
    }
    flaggedDocuments.updateRow(id, { status, resolved: false, resolved_at: null });
  };
  const setPriority = (id, priority) => flaggedDocuments.updateRow(id, sanitizeForSupabase({ priority }));

  // Auto-escalate to High priority once a flagged car registration has been open 4+ months (expires at 5)
  useEffect(() => {
    const toEscalate = flaggedDocuments.rows.filter((o) => o.sector !== "Documents" && !o.resolved && monthsElapsed(o.flagged_date) >= 4 && o.priority !== "High");
    toEscalate.forEach((o) => flaggedDocuments.updateRow(o.id, { priority: "High" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaggedDocuments.rows]);

  const renderRow = (o) => {
    const months = monthsElapsed(o.flagged_date);
    const nearExpiry = o.sector !== "Documents" && months >= 4;
    return (
      <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, borderLeft: nearExpiry ? `3px solid ${C.wax}` : "3px solid transparent", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{o.client || "Cliente sin nombre"}</div>
          {o.sector === "Documents" ? (
            <div style={{ fontSize: 11.5, color: C.muted }}>{o.document_description || "—"} · {o.objection_details || "sin detalle"}</div>
          ) : (
            <div style={{ fontSize: 11.5, color: C.muted }}>Padrón {o.registry_number || "—"} · {o.make_model || "—"} · Ingreso {o.registry_filing_number || "—"} · PIN {o.pin || "—"}</div>
          )}
          {nearExpiry && <div style={{ fontSize: 11, color: C.wax, fontWeight: 700, marginTop: 2 }}>⚠ Mes {months} de 5 — la inscripción caduca pronto</div>}
        </div>
        <PriorityPicker value={o.priority} onChange={(v) => setPriority(o.id, v)} />
        <select className="ec-select" style={{ width: "auto" }} value={o.status || FLAG_STATUSES[0]} onChange={(e) => setStatus(o.id, e.target.value)}>
          {FLAG_STATUSES.map((s) => <option key={s} value={s}>{translate(FLAG_STATUS_LABELS, s)}</option>)}
        </select>
        <DeleteButton onConfirm={() => remove(o.id)} confirmText="¿Eliminar esta observación?" />
      </div>
    );
  };

  const flaggedCars = flaggedDocuments.rows.filter((o) => o.sector !== "Documents" && !o.resolved);
  const flaggedDocs = flaggedDocuments.rows.filter((o) => o.sector === "Documents" && !o.resolved);
  const resolved = flaggedDocuments.rows.filter((o) => o.resolved).sort((a, b) => (b.resolved_at || "").localeCompare(a.resolved_at || ""));
  const [showHistory, setShowHistory] = useState(false);
  const ym = todayISO().slice(0, 7);
  const carsThisMonth = flaggedCars.filter((o) => o.flagged_date?.slice(0, 7) === ym).length;

  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Documentos observados</span>
        <button className="ec-btn-ghost" onClick={() => setAdding(true)}>+ Agregar</button>
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} onSubmit={save} title="Nueva observación">
        <div className="ec-form-grid">
          <Field label="Fecha de ingreso"><input className="ec-input" type="date" value={form.flagged_date} onChange={(e) => setForm({ ...form, flagged_date: e.target.value })} /></Field>
          <Field label="Sector"><select className="ec-select" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value, linked_record_id: "" })}>{SECTORS.map((t) => <option key={t} value={t}>{translate(SECTOR_LABELS, t)}</option>)}</select></Field>
          {form.sector === "Vehicles" ? (
            <Field label="Vincular a un auto existente (opcional)">
              <select className="ec-select" value={form.linked_record_id} onChange={(e) => linkToCar(e.target.value)}>
                <option value="">Carga manual</option>
                {(cars || []).map((a) => <option key={a.id} value={a.id}>{a.client || "Sin cliente"} · Padrón {a.registry_number || "—"}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Vincular a un documento existente (opcional)">
              <select className="ec-select" value={form.linked_record_id} onChange={(e) => linkToDocument(e.target.value)}>
                <option value="">Carga manual</option>
                {(documents || []).map((d) => <option key={d.id} value={d.id}>{d.client || "Sin cliente"} · {translate(DOCUMENT_TYPE_LABELS, d.document_type)}</option>)}
              </select>
            </Field>
          )}
          <Field label="Cliente"><input className="ec-input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
          <Field label="Estado"><select className="ec-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{FLAG_STATUSES.map((t) => <option key={t} value={t}>{translate(FLAG_STATUS_LABELS, t)}</option>)}</select></Field>
          {form.sector === "Vehicles" ? (
            <>
              <Field label="Padrón"><input className="ec-input" value={form.registry_number} onChange={(e) => setForm({ ...form, registry_number: e.target.value })} /></Field>
              <Field label="Marca y modelo"><input className="ec-input" placeholder="Ej: VW Gol" value={form.make_model} onChange={(e) => setForm({ ...form, make_model: e.target.value })} /></Field>
              <Field label="Número de inscripción"><input className="ec-input" value={form.registry_filing_number} onChange={(e) => setForm({ ...form, registry_filing_number: e.target.value })} /></Field>
              <Field label="PIN"><input className="ec-input" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></Field>
            </>
          ) : (
            <>
              <Field label="Qué documento está observado"><input className="ec-input" placeholder="Ej: Testimonio compraventa" value={form.document_description} onChange={(e) => setForm({ ...form, document_description: e.target.value })} /></Field>
              <Field label="Qué fue lo que se observó"><input className="ec-input" value={form.objection_details} onChange={(e) => setForm({ ...form, objection_details: e.target.value })} /></Field>
            </>
          )}
          <Field label="Prioridad"><select className="ec-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="">Sin definir</option>{PRIORITIES.map((t) => <option key={t} value={t}>{translate(PRIORITY_LABELS, t)}</option>)}</select></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Agregar"}</button></div>
      </AddPanel>

      <div style={{ padding: "8px 16px 2px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
        <span>Automotores</span>
        <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>Este mes: {carsThisMonth} · Total abiertos: {flaggedCars.length}</span>
      </div>
      <div>
        {flaggedCars.length === 0 && <div style={{ padding: "12px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>Sin observados de automotores.</div>}
        {flaggedCars.map(renderRow)}
      </div>

      <div style={{ padding: "10px 16px 2px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600, borderTop: `1px dashed ${C.line}` }}>Documentos</div>
      <div>
        {flaggedDocs.length === 0 && <div style={{ padding: "12px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>Sin observados de documentos.</div>}
        {flaggedDocs.map(renderRow)}
      </div>

      <div style={{ borderTop: `1.5px solid ${C.ink}`, marginTop: 4 }}>
        <button onClick={() => setShowHistory(!showHistory)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
          <span style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>Historial de resueltos ({resolved.length})</span>
          {showHistory ? <ChevronDown size={14} color={C.muted} /> : <ChevronRight size={14} color={C.muted} />}
        </button>
        {showHistory && (
          <div style={{ paddingBottom: 6 }}>
            {resolved.length === 0 && <div style={{ padding: "8px 16px", color: C.muted, fontSize: 12.5, textAlign: "center" }}>Todavía no se resolvió ninguno.</div>}
            {resolved.map((o) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderTop: `1px solid ${C.line}`, fontSize: 12.5 }}>
                <span className="ec-badge" style={{ background: C.paper2, color: C.brass }}>{translate(SECTOR_LABELS, o.sector)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{o.client || "Cliente sin nombre"}</div>
                  <div style={{ color: C.muted, fontSize: 11.5 }}>
                    {o.sector === "Documents" ? `${o.document_description || "—"} · ${o.objection_details || "sin detalle"}` : `Padrón ${o.registry_number || "—"} · ${o.make_model || "—"}`}
                  </div>
                </div>
                <span style={{ color: C.muted }}>{translate(FLAG_STATUS_LABELS, o.status)}</span>
                <span className="ec-mono" style={{ color: C.muted }}>Resuelto {fmtDate(o.resolved_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
