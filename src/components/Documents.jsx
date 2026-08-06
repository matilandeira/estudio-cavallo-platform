import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { C } from "../lib/theme.jsx";
import {
  STAFF, DOCUMENT_TYPES, PROBATE_STATUSES, POWER_OF_ATTORNEY_STATUSES, SCAN_STATUSES,
  RECONSTRUCTION_STATUSES, SAS_STATUSES, STATUSES, NEXT_ACTION_OWNERS, byPriority,
} from "../lib/constants.js";
import { todayISO } from "../lib/format.js";
import {
  isDocumentCompleted, isPendingLike, isSimplifiedDocument,
} from "../lib/businessLogic.js";
import { isScanning, isReconstruction, isSpecialType, isSAS as isSASType } from "../lib/constants.js";
import {
  label as translate, DOCUMENT_TYPE_LABELS, PROBATE_STATUS_LABELS, POA_STATUS_LABELS, SCAN_STATUS_LABELS,
  RECONSTRUCTION_STATUS_LABELS, SAS_STATUS_LABELS, STATUS_LABELS, NEXT_ACTION_OWNER_LABELS,
} from "../lib/labels.js";
import { Header, AddPanel, Field, FilterBar, AssigneesPicker, PriorityPicker, Check, assigneeMatches } from "./SharedUI.jsx";

const blankDocument = () => ({
  case_date: todayISO(), client: "", phone: "", document_type: DOCUMENT_TYPES[0], reference: "",
  assignees: ["Alex", "Belén"], drafted: false, reviewed: false, delivered: false, paid: false,
  status: "Pending", probate_status: PROBATE_STATUSES[0], power_of_attorney_status: POWER_OF_ATTORNEY_STATUSES[0],
  vehicle: "", registry_number: "", scan_status: SCAN_STATUSES[0], reconstruction_status: RECONSTRUCTION_STATUSES[0],
  documentation_requested: false, sas_status: SAS_STATUSES[0],
  next_action_owner: NEXT_ACTION_OWNERS[0], reminder_date: "", priority: "",
  notes: "", completed_at: null,
});

export default function Documents({ documents, simpleMode }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({});
  const [form, setForm] = useState(blankDocument());

  const filtered = documents.rows
    .filter((d) => !isDocumentCompleted(d) && (!filters.status || d.status === filters.status) && (!filters.assignee || assigneeMatches(d.assignees, filters.assignee)) && (!filters.document_type || d.document_type === filters.document_type))
    .sort(byPriority);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (isDocumentCompleted(payload)) payload.completed_at = todayISO();
      await documents.insertRow(payload);
      setForm(blankDocument());
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const update = (id, patch, opts) => {
    const doc = documents.rows.find((d) => d.id === id);
    if (!doc) return;
    const next = { ...doc, ...patch };
    const extra = {};
    const was = isDocumentCompleted(doc), now = isDocumentCompleted(next);
    if (now && !was) extra.completed_at = todayISO();
    if (!now && was) extra.completed_at = null;
    documents.updateRow(id, { ...patch, ...extra }, opts);
  };
  const remove = (id) => documents.removeRow(id);

  /* Which status field/options/labels apply, depending on document type */
  const primaryStatus = (d) => {
    if (isSimplifiedDocument(d.document_type)) return { value: d.power_of_attorney_status, options: POWER_OF_ATTORNEY_STATUSES, labels: POA_STATUS_LABELS, onChange: (v) => update(d.id, { power_of_attorney_status: v }) };
    if (d.document_type === "Estate Probate") return { value: d.probate_status, options: PROBATE_STATUSES, labels: PROBATE_STATUS_LABELS, onChange: (v) => update(d.id, { probate_status: v }) };
    if (isSASType(d.document_type)) return { value: d.sas_status, options: SAS_STATUSES, labels: SAS_STATUS_LABELS, onChange: (v) => update(d.id, { sas_status: v }) };
    if (isScanning(d.document_type)) return { value: d.scan_status, options: SCAN_STATUSES, labels: SCAN_STATUS_LABELS, onChange: (v) => update(d.id, { scan_status: v }) };
    if (isReconstruction(d.document_type)) return { value: d.reconstruction_status, options: RECONSTRUCTION_STATUSES, labels: RECONSTRUCTION_STATUS_LABELS, onChange: (v) => update(d.id, { reconstruction_status: v }) };
    return { value: d.status, options: STATUSES, labels: STATUS_LABELS, onChange: (v) => update(d.id, { status: v }) };
  };

  return (
    <div className="ec-fade">
      <Header title="Documentos" subtitle="Testimonios, certificados, poderes, sucesiones, SAS y otros." onAdd={() => setAdding(true)} />
      <AddPanel open={adding} onClose={() => setAdding(false)} title="Nuevo documento">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          <Field label="Fecha"><input className="ec-input" type="date" value={form.case_date} onChange={(e) => setForm({ ...form, case_date: e.target.value })} /></Field>
          <Field label="Cliente"><input className="ec-input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
          <Field label="Teléfono (WhatsApp)"><input className="ec-input" placeholder="09X XXX XXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Tipo de documento"><select className="ec-select" value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value })}>{DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{translate(DOCUMENT_TYPE_LABELS, t)}</option>)}</select></Field>
          <Field label="Responsable(s)"><AssigneesPicker value={form.assignees} onChange={(v) => setForm({ ...form, assignees: v })} /></Field>

          {isSimplifiedDocument(form.document_type) && (
            <Field label="Estado"><select className="ec-select" value={form.power_of_attorney_status} onChange={(e) => setForm({ ...form, power_of_attorney_status: e.target.value })}>{POWER_OF_ATTORNEY_STATUSES.map((t) => <option key={t} value={t}>{translate(POA_STATUS_LABELS, t)}</option>)}</select></Field>
          )}
          {form.document_type === "Estate Probate" && (
            <Field label="Estado de la sucesión"><select className="ec-select" value={form.probate_status} onChange={(e) => setForm({ ...form, probate_status: e.target.value })}>{PROBATE_STATUSES.map((t) => <option key={t} value={t}>{translate(PROBATE_STATUS_LABELS, t)}</option>)}</select></Field>
          )}
          {isScanning(form.document_type) && (
            <>
              <Field label="Vehículo"><input className="ec-input" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} /></Field>
              <Field label="Padrón"><input className="ec-input" value={form.registry_number} onChange={(e) => setForm({ ...form, registry_number: e.target.value })} /></Field>
              <Field label="Estado"><select className="ec-select" value={form.scan_status} onChange={(e) => setForm({ ...form, scan_status: e.target.value })}>{SCAN_STATUSES.map((t) => <option key={t} value={t}>{translate(SCAN_STATUS_LABELS, t)}</option>)}</select></Field>
            </>
          )}
          {isSASType(form.document_type) && (
            <>
              <Field label="Documentación pedida"><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, height: 33 }}><input type="checkbox" checked={form.documentation_requested} onChange={(e) => setForm({ ...form, documentation_requested: e.target.checked })} /> Sí</label></Field>
              <Field label="Estado"><select className="ec-select" value={form.sas_status} onChange={(e) => setForm({ ...form, sas_status: e.target.value })}>{SAS_STATUSES.map((t) => <option key={t} value={t}>{translate(SAS_STATUS_LABELS, t)}</option>)}</select></Field>
            </>
          )}
          {isReconstruction(form.document_type) && (
            <>
              <Field label="Padrón"><input className="ec-input" value={form.registry_number} onChange={(e) => setForm({ ...form, registry_number: e.target.value })} /></Field>
              <Field label="Marca y modelo"><input className="ec-input" placeholder="Ej: VW Gol" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} /></Field>
              <Field label="Estado"><select className="ec-select" value={form.reconstruction_status} onChange={(e) => setForm({ ...form, reconstruction_status: e.target.value })}>{RECONSTRUCTION_STATUSES.map((t) => <option key={t} value={t}>{translate(RECONSTRUCTION_STATUS_LABELS, t)}</option>)}</select></Field>
            </>
          )}
          {!isSpecialType(form.document_type) && (
            <>
              {!simpleMode && <Field label="Referencia / descripción"><input className="ec-input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>}
              <Field label="Estado"><select className="ec-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((t) => <option key={t} value={t}>{translate(STATUS_LABELS, t)}</option>)}</select></Field>
              {!simpleMode && <Field label="Quién tiene la pelota"><select className="ec-select" value={form.next_action_owner} onChange={(e) => setForm({ ...form, next_action_owner: e.target.value })}>{NEXT_ACTION_OWNERS.map((t) => <option key={t} value={t}>{translate(NEXT_ACTION_OWNER_LABELS, t)}</option>)}</select></Field>}
              {!simpleMode && <Field label="Próxima fecha clave"><input className="ec-input" type="date" value={form.reminder_date} onChange={(e) => setForm({ ...form, reminder_date: e.target.value })} /></Field>}
            </>
          )}
          <Field label="Observaciones"><input className="ec-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar documento"}</button></div>
      </AddPanel>

      <FilterBar filters={filters} setFilters={setFilters} options={[
        { key: "document_type", label: "Tipo", values: DOCUMENT_TYPES, labelFor: (v) => translate(DOCUMENT_TYPE_LABELS, v) },
        { key: "assignee", label: "Responsable", values: STAFF },
      ]} />

      <div style={{ display: "grid", gap: 10 }}>
        {filtered.length === 0 && <div className="ec-card" style={{ padding: 24, textAlign: "center", color: C.muted }}>No hay documentos registrados todavía.</div>}
        {filtered.map((d) => {
          const st = primaryStatus(d);
          const pending = isPendingLike(d);
          const dueReminder = pending && d.reminder_date && d.reminder_date <= todayISO();
          return (
            <div key={d.id} className="ec-card" style={{ padding: 14, borderColor: dueReminder ? C.wax : C.line }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", flex: 1, minWidth: 220 }}>
                  <input className="ec-input" style={{ width: 160, fontWeight: 700 }} placeholder="Cliente" value={d.client || ""} onChange={(e) => update(d.id, { client: e.target.value }, { debounce: true })} />
                  <span style={{ color: C.muted, fontSize: 13 }}>{translate(DOCUMENT_TYPE_LABELS, d.document_type)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select className="ec-select" style={{ width: "auto" }} value={st.value} onChange={(e) => st.onChange(e.target.value)}>
                    {st.options.map((s) => <option key={s} value={s}>{translate(st.labels, s)}</option>)}
                  </select>
                  <button onClick={() => remove(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, alignItems: "center" }}>
                <span className="ec-mono" style={{ fontSize: 12, color: C.muted }}>{d.case_date}</span>
                <Field label="Teléfono"><input className="ec-input" style={{ width: 130 }} value={d.phone || ""} onChange={(e) => update(d.id, { phone: e.target.value }, { debounce: true })} /></Field>
                <AssigneesPicker value={d.assignees} onChange={(v) => update(d.id, { assignees: v })} />
              </div>
              {!isSpecialType(d.document_type) && (
                <div style={{ marginTop: 8 }}>
                  <input className="ec-input" placeholder="Referencia / descripción" value={d.reference || ""} onChange={(e) => update(d.id, { reference: e.target.value }, { debounce: true })} />
                </div>
              )}

              {(isScanning(d.document_type) || isReconstruction(d.document_type)) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <Field label="Marca y modelo"><input className="ec-input" style={{ width: 160 }} value={d.vehicle || ""} onChange={(e) => update(d.id, { vehicle: e.target.value }, { debounce: true })} /></Field>
                  <Field label="Padrón"><input className="ec-input" style={{ width: 120 }} value={d.registry_number || ""} onChange={(e) => update(d.id, { registry_number: e.target.value }, { debounce: true })} /></Field>
                </div>
              )}

              {isSASType(d.document_type) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.documentation_requested} onChange={() => update(d.id, { documentation_requested: !d.documentation_requested })} /> Documentación pedida</label>
                </div>
              )}

              {!simpleMode && !isSpecialType(d.document_type) && (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.drafted} onChange={() => update(d.id, { drafted: !d.drafted })} /> Elaborado</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.reviewed} onChange={() => update(d.id, { reviewed: !d.reviewed })} /> Revisado</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.delivered} onChange={() => update(d.id, { delivered: !d.delivered })} /> Entregado</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.paid} onChange={() => update(d.id, { paid: !d.paid })} /> Cobrado</label>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, alignItems: "center", fontSize: 12.5 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: C.muted }}>Pelota:</span>
                      <select className="ec-select" style={{ width: "auto" }} value={d.next_action_owner} onChange={(e) => update(d.id, { next_action_owner: e.target.value })}>{NEXT_ACTION_OWNERS.map((q) => <option key={q} value={q}>{translate(NEXT_ACTION_OWNER_LABELS, q)}</option>)}</select>
                    </label>
                  </div>
                </>
              )}

              {!simpleMode && (pending || !isSpecialType(d.document_type)) && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}`, display: "flex", flexWrap: "wrap", gap: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ color: dueReminder ? C.wax : C.muted, fontWeight: dueReminder ? 700 : 400 }}>Próxima fecha clave:</span>
                    <input className="ec-input" style={{ width: 140 }} type="date" value={d.reminder_date || ""} onChange={(e) => update(d.id, { reminder_date: e.target.value })} />
                    {dueReminder && <span style={{ color: C.wax }}>⚠</span>}
                  </label>
                </div>
              )}
              {!simpleMode && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <PriorityPicker value={d.priority} onChange={(v) => update(d.id, { priority: v })} />
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <input className="ec-input" placeholder="Observaciones" value={d.notes || ""} onChange={(e) => update(d.id, { notes: e.target.value }, { debounce: true })} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
