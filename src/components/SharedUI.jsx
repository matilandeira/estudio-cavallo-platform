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
        style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex", alignItems: "center", padding: 8, margin: -8 }}
      >
        <Trash2 size={size} />
      </button>
      {confirming && (
        <div className="ec-card ec-fade" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, padding: 10, width: 190, maxWidth: "calc(100vw - 24px)", boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}>
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

/* ============================== ROW HIGHLIGHT (global search "jump to") ============================== */
/* Scrolls to and briefly pulses the row with DOM id `row-${highlightId}`.
   Copies the id into local state instead of reading the prop directly so
   the highlight fades on its own after a couple seconds rather than
   persisting for as long as the caller keeps the prop set. Pair with
   `id={`row-${row.id}`}` and `className={activeId === row.id ? "ec-card ec-highlight" : "ec-card"}`
   on the row being highlighted. */
export function useRowHighlight(highlightId) {
  const [activeId, setActiveId] = useState(null);
  useEffect(() => {
    if (!highlightId) return;
    setActiveId(highlightId);
    const el = document.getElementById(`row-${highlightId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setActiveId(null), 2500);
    return () => clearTimeout(t);
  }, [highlightId]);
  return activeId;
}

/* ============================== URGENT QUICK FILTER ============================== */
/* "⚡ Urgentes · vence esta semana" toggle shared by Home and the tabular
   views (Autos/Documentos/Inmuebles/Trabajos) — isolates overdue-or-due-
   within-7-days items (see isUrgent() in lib/format.js) with one click. */
export function UrgentFilterToggle({ active, onChange, count }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className="ec-chip"
      style={{
        fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5,
        background: active ? C.wax : C.white, color: active ? C.white : C.wax, borderColor: C.wax,
      }}
    >
      ⚡ Urgentes · vence esta semana{typeof count === "number" ? ` (${count})` : ""}
    </button>
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

/* Generic inline "add row" panel. Supports two keyboard shortcuts when
   `onSubmit` is passed: Ctrl/Cmd+Enter anywhere inside submits (bubbles up
   from any input/select), Esc closes — matching the app-wide shortcut set
   advertised in ShortcutsHelp below. */
export function AddPanel({ open, onClose, children, title, onSubmit }) {
  if (!open) return null;
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (onSubmit) { e.preventDefault(); onSubmit(); }
    } else if (e.key === "Escape") {
      onClose?.();
    }
  };
  return (
    <div className="ec-card ec-fade" style={{ padding: 16, marginBottom: 14, borderColor: C.brass, background: C.paper3 }} onKeyDown={handleKeyDown}>
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
    <button onClick={onChange} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, margin: -6, display: "flex", color: checked ? C.bottle : C.line }}>
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

/* ============================== BULK ACTION BAR ============================== */
/* Shown once one or more rows are checked (Autos/Documentos/Inmuebles). Both
   selects behave as one-shot action menus rather than persistent state:
   picking a value fires the bulk update immediately and resets itself to
   the placeholder, instead of trying to represent "the status of N
   different rows" as one selected option. */
export function BulkActionBar({ count, onClear, statusOptions, statusLabelFor, statusCaption, onBulkStatus, onBulkAssignee, assigneeOptions = STAFF }) {
  if (!count) return null;
  const fire = (handler) => (e) => {
    const v = e.target.value;
    if (v) handler(v);
    e.target.value = "";
  };
  return (
    <div className="ec-card ec-fade" style={{ padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: C.ink, borderColor: C.ink }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: C.white }}>{count} seleccionado{count === 1 ? "" : "s"}</span>
      {statusOptions && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.brassLight }}>
          Cambiar estado:
          <select className="ec-select" style={{ width: "auto" }} defaultValue="" onChange={fire(onBulkStatus)}>
            <option value="" disabled>Elegir…</option>
            {statusOptions.map((s) => <option key={s} value={s}>{statusLabelFor ? statusLabelFor(s) : s}</option>)}
          </select>
          {statusCaption && <span style={{ fontSize: 10.5, opacity: .85 }}>({statusCaption})</span>}
        </label>
      )}
      {onBulkAssignee && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.brassLight }}>
          Reasignar a:
          <select className="ec-select" style={{ width: "auto" }} defaultValue="" onChange={fire(onBulkAssignee)}>
            <option value="" disabled>Elegir…</option>
            {assigneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      )}
      <button className="ec-btn-ghost" style={{ marginLeft: "auto", borderColor: C.brassLight, color: C.brassLight }} onClick={onClear}>Cancelar selección</button>
    </div>
  );
}

/* ============================== KEYBOARD SHORTCUTS ============================== */
/* Global single-key shortcut (used for "N" = new item), suppressed while the
   user is typing in an input/select/textarea/contenteditable so it doesn't
   fire just because someone typed the letter "n" into a form field. Each
   tab component that supports it (Cars/Documents/Properties) registers its
   own listener — since only the active tab is ever mounted at a time, only
   one handler for a given key is ever live. */
export function useNewItemShortcut(onTrigger) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      const isTyping = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (isTyping) return;
      e.preventDefault();
      onTrigger();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);
}

const SHORTCUTS = [
  { keys: "Ctrl/Cmd + K", desc: "Buscar en autos, documentos, inmuebles y agenda" },
  { keys: "N", desc: "Nuevo trámite en Autos, Documentos e Inmuebles" },
  { keys: "Ctrl/Cmd + Enter", desc: "Guardar el formulario abierto" },
  { keys: "Esc", desc: "Cerrar el formulario, buscador o menú activo" },
];

/* Small "?" button in the header that pops a legend of every keyboard
   shortcut in the app — the shortcuts themselves work without it, this is
   purely so staff can discover them. */
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Atajos de teclado"
        style={{ background: "none", border: `1px solid ${C.brassLight}`, borderRadius: "50%", width: 22, height: 22, cursor: "pointer", color: C.brassLight, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
      >
        ?
      </button>
      {open && (
        <div className="ec-card ec-fade" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 250, padding: 12, width: 260, boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Atajos de teclado</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SHORTCUTS.map((s) => (
              <div key={s.keys} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <span className="ec-mono" style={{ fontSize: 11, background: C.paper2, padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap", flexShrink: 0 }}>{s.keys}</span>
                <span style={{ fontSize: 12, color: C.ink, textAlign: "right" }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
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
