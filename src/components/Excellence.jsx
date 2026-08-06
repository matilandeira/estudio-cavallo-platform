import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { LEVELS, computeScore } from "../lib/constants.js";
import { todayISO, fmtDate } from "../lib/format.js";
import { sanitizeForSupabase } from "../lib/sanitizePayload.js";
import { isCarCompleted, isDocumentCompleted, isPropertyCompleted, scoreCategoryForDocument, computeAutomaticTotals } from "../lib/businessLogic.js";
import { label as translate, CASE_TYPE_LABELS, DOCUMENT_TYPE_LABELS } from "../lib/labels.js";
import { assigneesLabel } from "./SharedUI.jsx";
import { Header, AddPanel, Field, Seal } from "./SharedUI.jsx";

const blankLog = () => ({ log_date: todayISO(), google_reviews: 0, negative_reviews: 0, notes: "" });

export default function Excellence({ dailyExcellenceLog, cars, documents, properties, flaggedDocuments, setTab }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [form, setForm] = useState(blankLog());
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const carRows = cars.rows, docRows = documents.rows, propRows = properties.rows;
  const monthEntries = dailyExcellenceLog.rows.filter((e) => e.log_date?.slice(0, 7) === month).sort((a, b) => (a.log_date < b.log_date ? 1 : -1));

  const totals = useMemo(() => {
    const t = { properties: 0, notarizations: 0, probates: 0, reviews: 0, certificates: 0, salesChecked: 0, salesFlagged: 0, negativeReviews: 0, flaggedCertificates: 0 };
    monthEntries.forEach((e) => { t.reviews += Number(e.google_reviews || 0); t.negativeReviews += Number(e.negative_reviews || 0); });
    const auto = computeAutomaticTotals(carRows, docRows, propRows, flaggedDocuments.rows, month);
    t.properties += auto.properties; t.notarizations += auto.notarizations; t.probates += auto.probates; t.certificates += auto.certificates;
    t.salesChecked += auto.salesChecked; t.salesFlagged += auto.salesFlagged; t.flaggedCertificates += auto.flaggedCertificates;
    return t;
  }, [monthEntries, carRows, docRows, propRows, flaggedDocuments.rows, month]);
  const score = computeScore(totals);
  const flaggedCarsTotal = (flaggedDocuments.rows || []).filter((f) => f.sector !== "Documents").length;
  const flaggedCarsThisMonth = (flaggedDocuments.rows || []).filter((f) => f.sector !== "Documents" && f.flagged_date?.slice(0, 7) === month).length;

  const save = async () => {
    setSaving(true);
    try {
      const payload = sanitizeForSupabase(form);
      payload.log_date = payload.log_date || todayISO(); // log_date is NOT NULL; sanitize alone would null it if cleared
      await dailyExcellenceLog.insertRow(payload);
      setForm(blankLog());
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };
  const remove = (id) => dailyExcellenceLog.removeRow(id);

  const numFields = [["google_reviews", "Reseñas"], ["negative_reviews", "Reseñas negativas"]];

  const [expandedCat, setExpandedCat] = useState(null);

  const drillDownLists = {
    properties: propRows.filter((p) => isPropertyCompleted(p) && p.completed_at?.slice(0, 7) === month).map((p) => ({ key: p.id, client: p.client, detail: `Padrón ${p.registry_number || "—"}`, assignee: assigneesLabel(p.assignees), tab: "properties" })),
    notarizations: carRows.filter((c) => isCarCompleted(c) && c.completed_at?.slice(0, 7) === month).map((c) => ({ key: c.id, client: c.client, detail: `${c.make_model || translate(CASE_TYPE_LABELS, c.case_type) || "—"}${c.registry_number ? " · Padrón " + c.registry_number : ""}`, assignee: assigneesLabel(c.assignees), tab: "cars" })),
    probates: docRows.filter((d) => isDocumentCompleted(d) && d.completed_at?.slice(0, 7) === month && scoreCategoryForDocument(d) === "probates").map((d) => ({ key: d.id, client: d.client, detail: translate(DOCUMENT_TYPE_LABELS, d.document_type), assignee: assigneesLabel(d.assignees), tab: "documents" })),
    certificates: docRows.filter((d) => isDocumentCompleted(d) && d.completed_at?.slice(0, 7) === month && scoreCategoryForDocument(d) === "certificates").map((d) => ({ key: d.id, client: d.client, detail: translate(DOCUMENT_TYPE_LABELS, d.document_type), assignee: assigneesLabel(d.assignees), tab: "documents" })),
  };

  const scoreRows = [
    ["Inmuebles", totals.properties, "15 pts c/u · automático", score.propertiesPts, "properties"],
    ["Protocolizaciones", totals.notarizations, "90/100/110/120+ · automático", score.notarizationsPts, "notarizations"],
    ["Sucesiones/Poder/SAS", totals.probates, "5 pts c/u · automático", score.probatesPts, "probates"],
    ["Reseñas en Google", totals.reviews, "5 / 10 · manual", score.reviewsPts, null],
    ["Certificados+testimonios", totals.certificates, "15/20/25+ · automático", score.certificatesPts, "certificates"],
    ["Calidad documental (% compraventas observadas)", score.pctFlagged !== null ? `${score.pctFlagged.toFixed(1)}%` : "sin datos", `≤5% / ≤10% · este mes ${flaggedCarsThisMonth} / total abiertos ${flaggedCarsTotal}`, score.qualityPts, null],
    ["Penalización calidad (≥15% obs.)", "—", "-10 una vez/mes", score.qualityPenalty, null],
    ["Reseñas negativas", totals.negativeReviews, "-10 c/u · manual", score.negativeReviewsPenalty, null],
    ["Certificados observados", totals.flaggedCertificates, "-5 c/u · automático", score.flaggedCertificatesPenalty, null],
  ];

  return (
    <div className="ec-fade">
      <Header title="Excelencia Operativa" subtitle="Inmuebles, protocolizaciones, sucesiones y certificados se suman automáticamente al finalizar la tarea. Reseñas y control de calidad se cargan a mano." onAdd={() => setAdding(true)} addLabel="Cargar día" />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12.5, color: C.muted }}>Mes:</span>
        <input className="ec-input" style={{ width: 160 }} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} title="Registro diario del equipo">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          <Field label="Fecha"><input className="ec-input" type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} /></Field>
          {numFields.map(([k, label]) => (
            <Field key={k} label={label}><input className="ec-input" type="number" min="0" value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} /></Field>
          ))}
          <Field label="Observaciones"><input className="ec-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar registro"}</button></div>
      </AddPanel>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18, marginBottom: 20 }}>
        <div className="ec-card" style={{ padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Seal level={score.level} size={160} />
          <div className="ec-mono" style={{ fontSize: 24, fontWeight: 600 }}>{score.total} pts</div>
          <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center" }}>
            {LEVELS.slice().reverse().map((n) => `${n.name} ${n.min}+`).join("  ·  ")}
          </div>
        </div>
        <div className="ec-card" style={{ padding: "6px 0" }}>
          <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}` }}>
            <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Desglose del puntaje — {month}</span>
          </div>
          <table className="ec-table">
            <thead><tr><th>Categoría</th><th>Acumulado</th><th>Referencia</th><th>Puntos</th></tr></thead>
            <tbody>
              {scoreRows.map((r) => (
                <React.Fragment key={r[0]}>
                  <tr onClick={() => r[4] && setExpandedCat(expandedCat === r[4] ? null : r[4])} style={{ cursor: r[4] ? "pointer" : "default" }}>
                    <td>{r[0]} {r[4] && (expandedCat === r[4] ? <ChevronDown size={12} style={{ display: "inline", verticalAlign: "middle" }} /> : <ChevronRight size={12} style={{ display: "inline", verticalAlign: "middle" }} />)}</td>
                    <td className="ec-mono">{r[1]}</td><td style={{ color: C.muted, fontSize: 12 }}>{r[2]}</td>
                    <td className="ec-mono" style={{ fontWeight: 700, color: r[3] < 0 ? C.wax : C.ink }}>{r[3] > 0 ? "+" : ""}{r[3]}</td>
                  </tr>
                  {expandedCat === r[4] && r[4] && (
                    <tr>
                      <td colSpan={4} style={{ background: C.paper3, padding: 0 }}>
                        {drillDownLists[r[4]].length === 0 ? (
                          <div style={{ padding: 12, color: C.muted, fontSize: 12.5 }}>Nada sumó en esta categoría en {month}.</div>
                        ) : (
                          <div>
                            {drillDownLists[r[4]].map((it) => (
                              <div key={it.key} onClick={() => setTab && setTab(it.tab)} style={{ display: "flex", gap: 12, padding: "8px 16px", borderTop: `1px solid ${C.line}`, cursor: setTab ? "pointer" : "default", fontSize: 12.5 }}>
                                <span style={{ fontWeight: 600, flex: 1 }}>{it.client || "—"}</span>
                                <span style={{ color: C.muted, flex: 1 }}>{it.detail}</span>
                                <span style={{ color: C.muted }}>{it.assignee}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              <tr><td colSpan={3} style={{ fontWeight: 700 }}>TOTAL</td><td className="ec-mono" style={{ fontWeight: 700, fontSize: 15 }}>{score.total}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="ec-card ec-scroll" style={{ overflowX: "auto" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}` }}>
          <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Registro diario</span>
        </div>
        <table className="ec-table">
          <thead><tr><th>Fecha</th>{numFields.map(([k, l]) => <th key={k}>{l}</th>)}<th>Obs.</th><th></th></tr></thead>
          <tbody>
            {monthEntries.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 20, color: C.muted }}>Sin registros este mes.</td></tr>}
            {monthEntries.map((e) => (
              <tr key={e.id}>
                <td className="ec-mono">{fmtDate(e.log_date)}</td>
                {numFields.map(([k]) => <td key={k} className="ec-mono">{e[k]}</td>)}
                <td>{e.notes || "—"}</td>
                <td><button onClick={() => remove(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
