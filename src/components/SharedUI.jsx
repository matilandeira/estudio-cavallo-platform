import React, { useEffect, useRef, useState } from "react";
import { X, Plus, CheckCircle2, Circle, Filter, AlertTriangle, CheckCircle, Trash2, Minus, Clock, Check as CheckIcon } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { STAFF, PRIORITIES, PRIORITY_COLOR, TRI_STATES } from "../lib/constants.js";
import { label as translate, PRIORITY_LABELS } from "../lib/labels.js";

/* ============================== TOASTS ============================== */
export function Toasts({ toasts, dismiss }) {
  return (
    <>
      {toasts.map((t, i) => (
        <div
          key={t.id}
          className="ec-toast"
          style={{
            bottom: 20 + i * 56,
            background: t.type === "error" ? C.wax : t.type === "undo" ? C.ink : C.bottle,
            color: C.white,
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: t.onUndo ? "default" : "pointer",
          }}
          onClick={() => { if (!t.onUndo) dismiss(t.id); }}
        >
          {t.type === "error" ? <AlertTriangle size={15} /> : t.type === "undo" ? <Trash2 size={15} color={C.brassLight} /> : <CheckCircle size={15} />}
          <span>{t.message}</span>
          {t.onUndo && (
            <button
              onClick={(e) => { e.stopPropagation(); t.onUndo(); dismiss(t.id); }}
              style={{ background: "none", border: `1px solid ${C.brassLight}`, color: C.brassLight, borderRadius: 3, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 2, flexShrink: 0 }}
            >
              Deshacer
            </button>
          )}
        </div>
      ))}
    </>
  );
}

/* ============================== DELETE CONFIRMATION ============================== */
/* Inline confirm-then-undo delete control used by every delete button in the
   app. Clicking shows a small popover to confirm; confirming calls
   onConfirm() (wired to removeRowWithUndo), which hides the row immediately
   and fires a "Deshacer" toast with a 5s window before the Supabase delete
   actually happens — see useSupabaseCollection.removeRowWithUndo. */
export function DeleteButton({ onConfirm, size = 14, title = "Eliminar", confirmText = "¿Eliminar este trámite?" }) {
  const [confirming, setConfirming] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!confirming) return;
    const onClickAway = (e) => { if (ref.current && !ref.current.contains(e.target)) setConfirming(false); };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [confirming]);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setConfirming((v) => !v)}
        title={title}
        style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex", alignItems: "center", padding: 0 }}
      >
        <Trash2 size={size} />
      </button>
      {confirming && (
        <div className="ec-card ec-fade" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, padding: 10, width: 190, boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}>
          <div style={{ fontSize: 12.5, marginBottom: 8, lineHeight: 1.4 }}>{confirmText}</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button className="ec-btn-ghost" style={{ padding: "4px 9px", fontSize: 12 }} onClick={() => setConfirming(false)}>Cancelar</button>
            <button className="ec-btn" style={{ padding: "4px 9px", fontSize: 12, background: C.wax, borderColor: C.wax }} onClick={() => { setConfirming(false); onConfirm(); }}>Eliminar</button>
          </div>
        </div>
      )}
    </span>
  );
}

/* High-contrast overdue indicator — replaces relying on a subtle 1px card
   border color alone, so an overdue reminder is scannable at a glance. */
export function OverdueBadge({ label = "Vencido" }) {
  return (
    <span className="ec-badge" style={{ background: C.wax, color: C.white, fontWeight: 700, gap: 4 }}>
      <AlertTriangle size={11} /> {label}
    </span>
  );
}

/* ============================== STATUS BADGE ============================== */
export function statusColor(status) {
  switch (status) {
    case "Completed": return { bg: "#DCE7DE", fg: C.bottle };
    case "Pending": return { bg: "#F0E2C8", fg: "#7A5A1E" };
    case "In Progress": return { bg: "#E4DEEF", fg: "#4B3A73" };
    case "On Hold": return { bg: "#F3DDE0", fg: C.wax };
    case "For Review": return { bg: "#DCE9EF", fg: "#2C5A6E" };
    default: return { bg: C.paper2, fg: C.muted };
  }
}
export function StatusBadge({ status, label }) {
  const { bg, fg } = statusColor(status);
  return <span className="ec-badge" style={{ background: bg, color: fg }}>{label || status || "—"}</span>;
}

/* The notarial seal — signature element for the level badge */
export function Seal({ level, size = 128 }) {
  const sealLabel = level ? level.name.toUpperCase() : "SIN NIVEL";
  const color = level ? level.color : C.muted;
  const textId = "seal-arc-" + sealLabel;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: "block" }}>
      <defs>
        <path id={textId + "-top"} d="M 30,100 A 70,70 0 0 1 170,100" fill="none" />
        <path id={textId + "-bot"} d="M 170,110 A 70,70 0 0 1 30,110" fill="none" />
      </defs>
      <circle cx="100" cy="100" r="94" fill="none" stroke={color} strokeWidth="3" />
      <circle cx="100" cy="100" r="82" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 4" />
      <text fontFamily="IBM Plex Mono" fontSize="11" fontWeight="600" letterSpacing="3" fill={color}>
        <textPath href={"#" + textId + "-top"} startOffset="50%" textAnchor="middle">ESTUDIO CAVALLO</textPath>
      </text>
      <text fontFamily="IBM Plex Mono" fontSize="11" fontWeight="600" letterSpacing="3" fill={color}>
        <textPath href={"#" + textId + "-bot"} startOffset="50%" textAnchor="middle">EXCELENCIA · OPERATIVA</textPath>
      </text>
      <text x="100" y="95" textAnchor="middle" fontFamily="Source Serif 4" fontWeight="700" fontSize="26" fill={color}>{sealLabel}</text>
      <text x="100" y="118" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="11" fill={color}>
        {level ? `bono ${level.bonus}` : "en construcción"}
      </text>
    </svg>
  );
}

/* Generic inline "add row" panel */
export function AddPanel({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="ec-card ec-fade" style={{ padding: 16, marginBottom: 14, borderColor: C.brass, background: C.paper3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
        <button className="ec-btn-ghost" onClick={onClose}><X size={14} /> Cerrar</button>
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

export function Check({ checked, onChange }) {
  return (
    <button onClick={onChange} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: checked ? C.bottle : C.line }}>
      {checked ? <CheckCircle2 size={18} /> : <Circle size={18} />}
    </button>
  );
}

/* Priority picker (Baja/Media/Alta) for pending work items */
export function PriorityPicker({ value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span style={{ color: C.muted }}>Prioridad:</span>
      <select className="ec-select" style={{ width: "auto", color: value ? PRIORITY_COLOR[value] : C.muted, fontWeight: value === "High" ? 700 : 500 }} value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin definir</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{translate(PRIORITY_LABELS, p)}</option>)}
      </select>
    </label>
  );
}

/* Picker for one or more assignees, as toggleable chips */
export function AssigneesPicker({ value, onChange }) {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  const toggle = (name) => {
    onChange(list.includes(name) ? list.filter((v) => v !== name) : [...list, name]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {STAFF.map((name) => (
        <button key={name} type="button" onClick={() => toggle(name)} className={`ec-chip ${list.includes(name) ? "active" : ""}`} style={{ padding: "2px 8px", fontSize: 11 }}>
          {name}
        </button>
      ))}
    </div>
  );
}
/* Text for displaying a list of assignees */
export const assigneesLabel = (v) => (Array.isArray(v) ? (v.length ? v.join(", ") : "Sin asignar") : (v || "Sin asignar"));
/* true if the assignee(s) of a record include the name chosen in a filter */
export const assigneeMatches = (v, name) => (Array.isArray(v) ? v.includes(name) : v === name);

/* Icon per tri-state, layered on top of color so the states are
   distinguishable without relying on hue alone (colorblind accessibility,
   and faster scanning at a glance). */
const TRI_ICONS = { not_requested: Minus, requested: Clock, ok: CheckIcon };

/* 3-state status: not requested (red, dash) -> requested (yellow, clock) -> ok (green, check). Click to advance. */
export function TriStatus({ value, onChange }) {
  const idx = Math.max(0, TRI_STATES.findIndex((s) => s.key === value));
  const state = TRI_STATES[idx];
  const Icon = TRI_ICONS[state.key];
  const advance = () => onChange(TRI_STATES[(idx + 1) % TRI_STATES.length].key);
  return (
    <button onClick={advance} title={`${state.label} — click para cambiar`}
      style={{ width: 17, height: 17, borderRadius: "50%", border: "1.5px solid rgba(0,0,0,.25)", background: state.color, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
      <Icon size={11} strokeWidth={3} />
    </button>
  );
}
export function TriLegend() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 11.5, color: C.muted, marginBottom: 10 }}>
      {TRI_STATES.map((s) => {
        const Icon = TRI_ICONS[s.key];
        return (
          <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: s.color, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Icon size={9} strokeWidth={3} />
            </span> {s.label}
          </span>
        );
      })}
    </div>
  );
}

/* ============================== FILTER BAR ============================== */
/* Each option may include `labelFor(v)` to translate its values for display
   while the underlying filter value (compared against English DB values)
   stays untouched; options without it (e.g. staff names) render as-is. */
export function FilterBar({ filters, setFilters, options }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
      <Filter size={14} color={C.muted} />
      {options.map((opt) => (
        <select key={opt.key} className="ec-select" style={{ width: "auto" }}
          value={filters[opt.key] || ""} onChange={(e) => setFilters({ ...filters, [opt.key]: e.target.value })}>
          <option value="">{opt.label}: Todos</option>
          {opt.values.map((v) => <option key={v} value={v}>{opt.labelFor ? opt.labelFor(v) : v}</option>)}
        </select>
      ))}
      {Object.values(filters).some(Boolean) && (
        <button className="ec-btn-ghost" onClick={() => setFilters({})}><X size={13} /> Limpiar</button>
      )}
    </div>
  );
}

/* ============================== SHARED HEADER ============================== */
export function Header({ title, subtitle, onAdd, addLabel = "Agregar", addDisabled = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
      <div>
        <h1 className="ec-serif" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 12.5, color: C.muted, margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      {onAdd && <button className="ec-btn" onClick={onAdd} disabled={addDisabled}><Plus size={14} /> {addLabel}</button>}
    </div>
  );
}

export function LoadingBlock({ label = "Cargando…" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, padding: 40, justifyContent: "center" }}>
      <span className="ec-spin" style={{ display: "inline-flex" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
      </span>
      {label}
    </div>
  );
}
