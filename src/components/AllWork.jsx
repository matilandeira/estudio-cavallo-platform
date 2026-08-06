import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { C } from "../lib/theme.jsx";
import {
  STAFF, PRIORITIES, PRIORITY_COLOR, CAR_STATUSES, STATUSES, POWER_OF_ATTORNEY_STATUSES,
  PROBATE_STATUSES, SAS_STATUSES, SCAN_STATUSES, RECONSTRUCTION_STATUSES, FLAG_STATUSES,
} from "../lib/constants.js";
import { todayISO, fmtDate, isUrgent } from "../lib/format.js";
import { sanitizeForSupabase } from "../lib/sanitizePayload.js";
import {
  label as translate, CAR_STATUS_LABELS, STATUS_LABELS, DOCUMENT_TYPE_LABELS, PRIORITY_LABELS,
  ORIGIN_LABELS, documentStatusLabelEs, bestEffortStatusLabel,
} from "../lib/labels.js";
import { Header, FilterBar, StatusBadge, assigneesLabel, assigneeMatches, DeleteButton, UrgentFilterToggle } from "./SharedUI.jsx";
import FlaggedDocuments from "./FlaggedDocuments.jsx";

export default function AllWork({ cars, documents, properties, flaggedDocuments, setTab, initialFilters }) {
  const [filters, setFilters] = useState(initialFilters || {});
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);

  const items = useMemo(() => {
    const c = cars.rows.map((x) => ({
      key: "car-" + x.id, rawId: x.id, origin: "Car",
      type: `${x.make_model || x.case_type || "—"}${x.registry_number ? " · Padrón " + x.registry_number : ""}`,
      client: x.client, assignees: [...new Set([...(x.assignees || []), ...(x.notarization_assignees || [])])],
      status: x.status, statusLabel: translate(CAR_STATUS_LABELS, x.status), priority: x.priority, date: x.case_date, tab: "cars",
      extra: (x.registry_filing_number || x.pin) ? `Ingreso ${x.registry_filing_number || "—"} · PIN ${x.pin || "—"}` : "",
      registryNumber: x.registry_number, makeModel: x.make_model, registryFilingNumber: x.registry_filing_number, pin: x.pin,
      reminderDate: x.reminder_date,
    }));
    const d = documents.rows.map((x) => ({
      key: "doc-" + x.id, rawId: x.id, origin: "Document", type: translate(DOCUMENT_TYPE_LABELS, x.document_type), client: x.client,
      assignees: x.assignees, status: null, statusLabel: documentStatusLabelEs(x), priority: x.priority, date: x.case_date, tab: "documents",
      extra: "", documentType: x.document_type, reminderDate: x.reminder_date,
    }));
    const p = properties.rows.map((x) => ({
      key: "prop-" + x.id, rawId: x.id, origin: "Property", type: `Padrón ${x.registry_number || "—"}`, client: x.client,
      assignees: x.assignees, status: x.status, statusLabel: translate(STATUS_LABELS, x.status), priority: x.priority, date: x.case_date, tab: "properties",
      extra: (x.registry_filing_number || x.pin) ? `Ingreso ${x.registry_filing_number || "—"} · PIN ${x.pin || "—"}` : "",
      reminderDate: x.reminder_date,
    }));
    const rank = { High: 0, Medium: 1, Low: 2, "": 3 };
    return [...c, ...d, ...p].sort((p1, q1) => (rank[p1.priority || ""] - rank[q1.priority || ""]) || (q1.date || "").localeCompare(p1.date || ""));
  }, [cars.rows, documents.rows, properties.rows]);

  const alreadyFlagged = (it) => (flaggedDocuments.rows || []).some((o) => o.linked_record_id === it.rawId);
  const clearFlag = (it) => {
    const matches = (flaggedDocuments.rows || []).filter((o) => o.linked_record_id === it.rawId);
    matches.forEach((o) => flaggedDocuments.removeRowWithUndo(o.id, { message: "Quitado de observados · Deshacer" }));
  };
  const deleteWork = (it) => {
    if (it.origin === "Car") cars.removeRowWithUndo(it.rawId);
    else if (it.origin === "Document") documents.removeRowWithUndo(it.rawId);
    else if (it.origin === "Property") properties.removeRowWithUndo(it.rawId);
  };
  const flagIt = (it) => {
    if (alreadyFlagged(it)) return;
    if (it.origin === "Car") {
      flaggedDocuments.insertRow(sanitizeForSupabase({ flagged_date: todayISO(), sector: "Vehicles", linked_record_id: it.rawId, client: it.client, registry_number: it.registryNumber || "", make_model: it.makeModel || "", registry_filing_number: it.registryFilingNumber || "", pin: it.pin || "", document_description: "", objection_details: "", status: FLAG_STATUSES[0], priority: "" }));
    } else if (it.origin === "Document") {
      flaggedDocuments.insertRow(sanitizeForSupabase({ flagged_date: todayISO(), sector: "Documents", linked_record_id: it.rawId, client: it.client, registry_number: "", make_model: "", registry_filing_number: "", pin: "", document_description: it.documentType || "", objection_details: "", status: FLAG_STATUSES[0], priority: "" }));
    }
  };

  const filtered = items.filter((it) =>
    (!filters.assignee || assigneeMatches(it.assignees, filters.assignee)) &&
    (!filters.origin || it.origin === filters.origin) &&
    (!filters.status || it.status === filters.status) &&
    (!filters.priority || it.priority === filters.priority) &&
    (!month || it.date?.slice(0, 7) === month) &&
    (!search || `${it.client} ${it.type}`.toLowerCase().includes(search.toLowerCase())) &&
    (!urgentOnly || isUrgent(it.reminderDate, it.status))
  );
  const urgentCount = items.filter((it) => isUrgent(it.reminderDate, it.status)).length;

  const allStatuses = [...new Set([...CAR_STATUSES, ...STATUSES, ...POWER_OF_ATTORNEY_STATUSES, ...PROBATE_STATUSES, ...SAS_STATUSES, ...SCAN_STATUSES, ...RECONSTRUCTION_STATUSES])];

  return (
    <div className="ec-fade">
      <Header title="Todos los trabajos" subtitle="Autos, documentos e inmuebles en un solo lugar, filtrable por responsable." />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 280, flex: "1 1 220px" }}>
          <Search size={14} color={C.muted} />
          <input className="ec-input" placeholder="Buscar por cliente, padrón o marca y modelo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input className="ec-input" style={{ width: 150 }} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {month && <button className="ec-btn-ghost" onClick={() => setMonth("")}><X size={13} /> Mes</button>}
        <FilterBar filters={filters} setFilters={setFilters} options={[
          { key: "assignee", label: "Responsable", values: STAFF },
          { key: "origin", label: "Tipo", values: ["Car", "Document", "Property"], labelFor: (v) => translate(ORIGIN_LABELS, v) },
          { key: "status", label: "Estado", values: allStatuses, labelFor: (v) => bestEffortStatusLabel(v) },
          { key: "priority", label: "Prioridad", values: PRIORITIES, labelFor: (v) => translate(PRIORITY_LABELS, v) },
        ]} />
        <UrgentFilterToggle active={urgentOnly} onChange={setUrgentOnly} count={urgentCount} />
      </div>

      <div className="ec-card ec-scroll" style={{ overflowX: "auto" }}>
        <table className="ec-table">
          <thead><tr><th>Origen</th><th>Cliente</th><th>Detalle</th><th>Ingreso / PIN</th><th>Responsable</th><th>Estado</th><th>Prioridad</th><th>Fecha</th><th></th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: C.muted }}>No hay trabajos que coincidan con el filtro.</td></tr>}
            {filtered.map((it) => (
              <tr key={it.key} onClick={() => setTab(it.tab)} style={{ cursor: "pointer" }}>
                <td><span className="ec-badge" style={{ background: C.paper2, color: C.brass }}>{translate(ORIGIN_LABELS, it.origin)}</span></td>
                <td>{it.client || "—"}</td>
                <td>{it.type}</td>
                <td style={{ color: C.muted, fontSize: 12 }}>{it.extra || "—"}</td>
                <td>{assigneesLabel(it.assignees)}</td>
                <td><StatusBadge status={it.status} label={it.statusLabel} /></td>
                <td>{it.priority ? <span style={{ color: PRIORITY_COLOR[it.priority], fontWeight: it.priority === "High" ? 700 : 500 }}>{translate(PRIORITY_LABELS, it.priority)}</span> : <span style={{ color: C.muted }}>—</span>}</td>
                <td className="ec-mono">{fmtDate(it.date)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {it.origin !== "Property" && (
                    alreadyFlagged(it) ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted }}>Observado</span>
                        <DeleteButton onConfirm={() => clearFlag(it)} size={13} title="Eliminar de Documentos observados" confirmText="¿Quitar de Documentos observados?" />
                      </span>
                    ) : (
                      <button onClick={() => flagIt(it)} className="ec-btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }}>Marcar observado</button>
                    )
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <DeleteButton onConfirm={() => deleteWork(it)} title="Eliminar este trabajo" confirmText="¿Eliminar este trabajo?" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ec-card" style={{ padding: "6px 0", marginTop: 18 }}>
        <FlaggedDocuments flaggedDocuments={flaggedDocuments} cars={cars.rows} documents={documents.rows} />
      </div>
    </div>
  );
}
