import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Car, FileText, Home as HomeIcon, CalendarClock } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { fmtDate } from "../lib/format.js";
import { label as translate, DOCUMENT_TYPE_LABELS } from "../lib/labels.js";

const MAX_PER_GROUP = 6;

/* Accent/case-insensitive match — lets "nunez" find "NUÑEZ", "padron" find
   "padrón", etc. The rest of the app's search inputs don't bother with this
   (plain .toLowerCase().includes()), but it costs nothing extra here and a
   command-palette-style search is exactly where users expect it to just work. */
const normalize = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* Global Ctrl/Cmd+K search across cars, documents, properties and the
   signing agenda. All four collections are already loaded client-side (see
   useSupabaseCollection), so this is a pure in-memory filter — no extra
   Supabase round trip, no debounce needed. Picking a result calls
   onNavigate(tab, id), which AuthenticatedApp wires to switch tabs and
   highlight the matching row (see useRowHighlight in SharedUI.jsx). */
export default function GlobalSearch({ cars, documents, properties, signingAppointments, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const onClickAway = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClickAway);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onClickAway); };
  }, [open]);

  const groups = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    const matches = (...fields) => fields.some((f) => f && normalize(f).includes(q));

    const autos = (cars?.rows || [])
      .filter((c) => matches(c.client, c.registry_number, c.make_model, c.plate_number))
      .slice(0, MAX_PER_GROUP)
      .map((c) => ({
        id: c.id, tab: "cars",
        title: c.client || "Cliente sin nombre",
        subtitle: [c.make_model, c.registry_number ? `Padrón ${c.registry_number}` : null].filter(Boolean).join(" · ") || "—",
      }));

    const inmuebles = (properties?.rows || [])
      .filter((p) => matches(p.client, p.registry_number, p.notes, p.next_action))
      .slice(0, MAX_PER_GROUP)
      .map((p) => ({
        id: p.id, tab: "properties",
        title: p.client || "Cliente sin nombre",
        subtitle: p.registry_number ? `Padrón ${p.registry_number}` : "—",
      }));

    const documentos = (documents?.rows || [])
      .filter((d) => matches(d.client, d.document_type, translate(DOCUMENT_TYPE_LABELS, d.document_type)))
      .slice(0, MAX_PER_GROUP)
      .map((d) => ({
        id: d.id, tab: "documents",
        title: d.client || "Cliente sin nombre",
        subtitle: translate(DOCUMENT_TYPE_LABELS, d.document_type) || "—",
      }));

    const agenda = (signingAppointments?.rows || [])
      .filter((a) => matches(a.client, a.description))
      .slice(0, MAX_PER_GROUP)
      .map((a) => ({
        id: a.id, tab: "home",
        title: a.client || "Cliente sin nombre",
        subtitle: [a.description, a.appointment_date ? fmtDate(a.appointment_date) : null].filter(Boolean).join(" · ") || "—",
      }));

    return [
      { key: "cars", label: "Autos", icon: Car, items: autos },
      { key: "properties", label: "Inmuebles", icon: HomeIcon, items: inmuebles },
      { key: "documents", label: "Documentos", icon: FileText, items: documentos },
      { key: "agenda", label: "Agenda de firmas", icon: CalendarClock, items: agenda },
    ].filter((g) => g.items.length > 0);
  }, [query, cars, documents, properties, signingAppointments]);

  const totalResults = groups.reduce((n, g) => n + g.items.length, 0);

  const pick = (item) => {
    onNavigate(item.tab, item.id);
    setOpen(false);
  };

  return (
    <>
      <button
        data-tour="global-search"
        onClick={() => setOpen(true)}
        title="Buscar (Ctrl/Cmd+K)"
        style={{ background: "none", border: `1px solid ${C.brassLight}`, borderRadius: 4, cursor: "pointer", color: C.brassLight, fontSize: 12, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}
      >
        <Search size={14} />
        {/* "Buscar" label + shortcut hint only make sense with a physical keyboard */}
        <span className="ec-hide-mobile" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Buscar <span className="ec-mono" style={{ opacity: .75 }}>Ctrl K</span>
        </span>
      </button>

      {open && (
        <div className="ec-search-overlay" style={{ position: "fixed", inset: 0, background: "rgba(30,42,36,.5)", zIndex: 300, display: "flex", justifyContent: "center", paddingTop: "12vh" }}>
          <div
            ref={containerRef}
            className="ec-card ec-fade"
            style={{ width: 560, maxWidth: "calc(100vw - 32px)", maxHeight: "70vh", height: "fit-content", display: "flex", flexDirection: "column", overflow: "hidden", background: C.white, boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1.5px solid ${C.ink}`, flexShrink: 0 }}>
              <Search size={16} color={C.muted} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente, padrón, marca y modelo, tipo de documento…"
                style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "inherit", background: "transparent", color: C.ink }}
              />
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex" }}><X size={16} /></button>
            </div>

            <div className="ec-scroll" style={{ overflowY: "auto" }}>
              {!query && (
                <div style={{ padding: "24px 16px", textAlign: "center", color: C.muted, fontSize: 13 }}>
                  Escribí para buscar en autos, inmuebles, documentos y la agenda de firmas.
                </div>
              )}
              {query && totalResults === 0 && (
                <div style={{ padding: "24px 16px", textAlign: "center", color: C.muted, fontSize: 13 }}>
                  Sin resultados para «{query}».
                </div>
              )}
              {groups.map((g) => (
                <div key={g.key} style={{ padding: "6px 0" }}>
                  <div style={{ padding: "6px 16px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: C.muted, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <g.icon size={12} /> {g.label}
                  </div>
                  {g.items.map((it) => (
                    <button
                      key={g.key + "-" + it.id}
                      onClick={() => pick(it)}
                      onMouseDown={(e) => e.preventDefault()}
                      className="ec-search-result"
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "8px 16px", display: "flex", flexDirection: "column", gap: 2 }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{it.title}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>{it.subtitle}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
