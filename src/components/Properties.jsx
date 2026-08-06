import React, { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { STAFF, PROPERTY_TYPES, PROPERTY_STAGES, STATUSES, NEXT_ACTION_OWNERS, byPriority } from "../lib/constants.js";
import { todayISO } from "../lib/format.js";
import { isPropertyCompleted } from "../lib/businessLogic.js";
import { label as translate, PROPERTY_TYPE_LABELS, PROPERTY_STAGE_LABELS, STATUS_LABELS } from "../lib/labels.js";
import { Header, AddPanel, Field, FilterBar, AssigneesPicker, PriorityPicker, Check, TriStatus, TriLegend, assigneeMatches } from "./SharedUI.jsx";

const blankProperty = () => ({
  case_date: todayISO(), property_type: PROPERTY_TYPES[0], client: "", registry_number: "", assignees: ["Dahiana"],
  registry_filing_number: "", pin: "", buyer_phone: "", seller_phone: "", notary_phone: "",
  id_cards: false, titles: false, survey_plan: false, property_tax_receipt: false, school_tax_receipt: false,
  cadastral_info: false, project_plan: false, personal_status_certificate: false, property_certificate: false,
  business_lien_certificate: false, first_copy: false, taxes_paid: false,
  offering_certificate: false, article_358_certificate: false, colonization_certificate: false, mining_certificate: false,
  registration_status: "not_requested", stage: PROPERTY_STAGES[0], status: "Pending", next_action_owner: NEXT_ACTION_OWNERS[0],
  next_action: "", reminder_date: "", priority: "", notes: "", completed_at: null, ready_to_schedule: false,
});

/* Checklist labels are pure display text (only the field key is a real DB column), kept in Spanish directly. */
const BASE_CHECKLIST = [
  ["id_cards", "Cédulas"], ["titles", "Títulos"], ["survey_plan", "Plano"], ["property_tax_receipt", "Contribución"],
  ["school_tax_receipt", "Primaria"], ["cadastral_info", "Caracterización urbana"], ["project_plan", "Proyecto"],
  ["personal_status_certificate", "Actos personales"], ["property_certificate", "Cert. de propiedad"],
  ["business_lien_certificate", "Cert. de comercio o prenda"], ["first_copy", "Primera copia"], ["taxes_paid", "Pago de impuestos"],
];
const RURAL_CHECKLIST = [["offering_certificate", "Ofrecimiento"], ["article_358_certificate", "Art. 358"], ["colonization_certificate", "Colonización"], ["mining_certificate", "Minería"]];
const checklistFor = (propertyType) => (propertyType === "Rural" ? [...BASE_CHECKLIST, ...RURAL_CHECKLIST] : BASE_CHECKLIST);
const isLateStage = (stage) => !["Preparing Agreement", "Agreement Approved", "Ready to Sign", "Agreement Signed", "Promise of Sale", "Sale Deed"].includes(stage);
const isRegistryOnlyStage = (stage) => stage === "Documentation Received";

export default function Properties({ properties, documentsReadyToSchedule, simpleMode }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [form, setForm] = useState(blankProperty());

  const filtered = properties.rows.filter((i) =>
    !isPropertyCompleted(i) &&
    (!search || `${i.client} ${i.registry_number}`.toLowerCase().includes(search.toLowerCase())) &&
    (!filters.assignee || assigneeMatches(i.assignees, filters.assignee)) &&
    (!filters.status || i.status === filters.status)
  ).sort(byPriority);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (isPropertyCompleted(payload)) payload.completed_at = todayISO();
      await properties.insertRow(payload);
      setForm(blankProperty());
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const update = (id, patch, opts) => {
    const property = properties.rows.find((i) => i.id === id);
    if (!property) return;
    const next = { ...property, ...patch };
    const extra = {};
    const was = isPropertyCompleted(property), now = isPropertyCompleted(next);
    if (now && !was) extra.completed_at = todayISO();
    if (!now && was) extra.completed_at = null;
    if (next.stage === "Ready to Sign" && property.stage !== "Ready to Sign" && !next.ready_to_schedule) {
      extra.ready_to_schedule = true;
      documentsReadyToSchedule.insertRow({ client: next.client, description: `Padrón ${next.registry_number || "—"}`, notes: next.notes || "" });
    }
    properties.updateRow(id, { ...patch, ...extra }, opts);
  };
  const remove = (id) => properties.removeRow(id);

  return (
    <div className="ec-fade">
      <Header title="Inmuebles" subtitle="Seguimiento por cliente y padrón, con checklist y etapa." onAdd={() => setAdding(true)} />
      <AddPanel open={adding} onClose={() => setAdding(false)} title="Nuevo inmueble">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
          <Field label="Fecha"><input className="ec-input" type="date" value={form.case_date} onChange={(e) => setForm({ ...form, case_date: e.target.value })} /></Field>
          <Field label="Tipo"><select className="ec-select" value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>{PROPERTY_TYPES.map((t) => <option key={t} value={t}>{translate(PROPERTY_TYPE_LABELS, t)}</option>)}</select></Field>
          <Field label="Cliente"><input className="ec-input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
          <Field label="Padrón"><input className="ec-input" value={form.registry_number} onChange={(e) => setForm({ ...form, registry_number: e.target.value })} /></Field>
          <Field label="Responsable(s)"><AssigneesPicker value={form.assignees} onChange={(v) => setForm({ ...form, assignees: v })} /></Field>
          <Field label="Etapa"><select className="ec-select" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>{PROPERTY_STAGES.map((t) => <option key={t} value={t}>{translate(PROPERTY_STAGE_LABELS, t)}</option>)}</select></Field>
          {isLateStage(form.stage) && !isRegistryOnlyStage(form.stage) && (
            <Field label="Estado"><select className="ec-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((t) => <option key={t} value={t}>{translate(STATUS_LABELS, t)}</option>)}</select></Field>
          )}
          {isLateStage(form.stage) && (
            <>
              <Field label="Número de ingreso"><input className="ec-input" value={form.registry_filing_number} onChange={(e) => setForm({ ...form, registry_filing_number: e.target.value })} /></Field>
              <Field label="PIN"><input className="ec-input" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></Field>
            </>
          )}
          {!simpleMode && !isRegistryOnlyStage(form.stage) && (
            <>
              <Field label="Próxima acción"><input className="ec-input" value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} /></Field>
              <Field label="Próxima fecha clave"><input className="ec-input" type="date" value={form.reminder_date} onChange={(e) => setForm({ ...form, reminder_date: e.target.value })} /></Field>
            </>
          )}
          {!simpleMode && (
            <>
              <Field label="Teléfono comprador"><input className="ec-input" value={form.buyer_phone} onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} /></Field>
              <Field label="Teléfono vendedor"><input className="ec-input" value={form.seller_phone} onChange={(e) => setForm({ ...form, seller_phone: e.target.value })} /></Field>
              <Field label="Teléfono escribano"><input className="ec-input" value={form.notary_phone} onChange={(e) => setForm({ ...form, notary_phone: e.target.value })} /></Field>
            </>
          )}
        </div>
        <div style={{ marginBottom: 12 }}>
          <Field label="Observaciones"><input className="ec-input" placeholder="Qué falta / en qué situación estamos" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        {!simpleMode && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
            {checklistFor(form.property_type).map(([k, label]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} /> {label}
              </label>
            ))}
          </div>
        )}
        <button className="ec-btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar inmueble"}</button>
      </AddPanel>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 320, flex: "1 1 240px" }}>
          <Search size={14} color={C.muted} />
          <input className="ec-input" placeholder="Buscar por cliente o padrón…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <FilterBar filters={filters} setFilters={setFilters} options={[
          { key: "assignee", label: "Responsable", values: STAFF },
          { key: "status", label: "Estado", values: STATUSES, labelFor: (v) => translate(STATUS_LABELS, v) },
        ]} />
      </div>

      <TriLegend />
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.length === 0 && <div className="ec-card" style={{ padding: 24, textAlign: "center", color: C.muted }}>No se encontraron inmuebles.</div>}
        {filtered.map((i) => {
          const keys = checklistFor(i.property_type);
          const done = keys.filter(([k]) => i[k]).length;
          const overdue = i.reminder_date && i.status !== "Completed" && i.reminder_date < todayISO();
          return (
            <div key={i.id} className="ec-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flex: 1, minWidth: 260 }}>
                  <input className="ec-input" style={{ width: 150, fontWeight: 700 }} placeholder="Cliente" value={i.client || ""} onChange={(e) => update(i.id, { client: e.target.value }, { debounce: true })} />
                  <Field label="Padrón"><input className="ec-input" style={{ width: 100 }} value={i.registry_number || ""} onChange={(e) => update(i.id, { registry_number: e.target.value }, { debounce: true })} /></Field>
                  <span className="ec-badge" style={{ background: C.paper2, color: i.property_type === "Rural" ? C.bottle : C.brass }}>{translate(PROPERTY_TYPE_LABELS, i.property_type) || "Urbano"}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {isLateStage(i.stage) && !isRegistryOnlyStage(i.stage) && (
                    <select className="ec-select" style={{ width: "auto" }} value={i.status} onChange={(e) => update(i.id, { status: e.target.value })}>
                      {STATUSES.map((s) => <option key={s} value={s}>{translate(STATUS_LABELS, s)}</option>)}
                    </select>
                  )}
                  <button onClick={() => remove(i.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <AssigneesPicker value={i.assignees} onChange={(v) => update(i.id, { assignees: v })} />
              </div>
              {!simpleMode && (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                    {keys.map(([k, label]) => (
                      <label key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: i[k] ? C.bottle : C.muted }}>
                        <Check checked={i[k]} onChange={() => update(i.id, { [k]: !i[k] })} /> {label}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}` }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={i.registration_status} onChange={(v) => update(i.id, { registration_status: v })} /> Inscripción</label>
                  </div>
                </>
              )}
              {isLateStage(i.stage) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}` }}>
                  <Field label="Número de ingreso"><input className="ec-input" style={{ width: 160 }} value={i.registry_filing_number || ""} onChange={(e) => update(i.id, { registry_filing_number: e.target.value }, { debounce: true })} /></Field>
                  <Field label="PIN"><input className="ec-input" style={{ width: 120 }} value={i.pin || ""} onChange={(e) => update(i.id, { pin: e.target.value }, { debounce: true })} /></Field>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  {simpleMode ? (
                    <input className="ec-input" placeholder="Qué falta / en qué situación estamos" value={i.notes || ""} onChange={(e) => update(i.id, { notes: e.target.value }, { debounce: true })} />
                  ) : (
                    <div style={{ height: 5, background: C.paper2, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(done / keys.length) * 100}%`, background: C.brass }} />
                    </div>
                  )}
                </div>
                <select className="ec-select" style={{ width: "auto" }} value={i.stage} onChange={(e) => update(i.id, { stage: e.target.value })}>
                  {PROPERTY_STAGES.map((e) => <option key={e} value={e}>{translate(PROPERTY_STAGE_LABELS, e)}</option>)}
                </select>
                {!simpleMode && !isRegistryOnlyStage(i.stage) && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{ color: overdue ? C.wax : C.muted, fontWeight: overdue ? 700 : 400 }}>Próx.: {i.next_action || "—"} —</span>
                      <input className="ec-input" style={{ width: 140 }} type="date" value={i.reminder_date || ""} onChange={(e) => update(i.id, { reminder_date: e.target.value })} />
                      {overdue && <span style={{ color: C.wax }}>⚠</span>}
                    </label>
                    <PriorityPicker value={i.priority} onChange={(v) => update(i.id, { priority: v })} />
                  </>
                )}
              </div>
              {!simpleMode && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <Field label="Teléfono comprador"><input className="ec-input" style={{ width: 150 }} value={i.buyer_phone || ""} onChange={(e) => update(i.id, { buyer_phone: e.target.value }, { debounce: true })} /></Field>
                  <Field label="Teléfono vendedor"><input className="ec-input" style={{ width: 150 }} value={i.seller_phone || ""} onChange={(e) => update(i.id, { seller_phone: e.target.value }, { debounce: true })} /></Field>
                  <Field label="Teléfono escribano"><input className="ec-input" style={{ width: 150 }} value={i.notary_phone || ""} onChange={(e) => update(i.id, { notary_phone: e.target.value }, { debounce: true })} /></Field>
                </div>
              )}
              {!simpleMode && (
                <div style={{ marginTop: 10 }}>
                  <input className="ec-input" placeholder="Observaciones — información importante" value={i.notes || ""} onChange={(e) => update(i.id, { notes: e.target.value }, { debounce: true })} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
