import React, { useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { PROCEDURES } from "../lib/constants.js";
import { Header } from "./SharedUI.jsx";

export default function Manual() {
  const [openId, setOpenId] = useState(PROCEDURES[0].id);
  const [q, setQ] = useState("");
  const filtered = PROCEDURES.map((p) => ({
    ...p,
    steps: p.steps.filter((s) => !q || s.toLowerCase().includes(q.toLowerCase())),
  })).filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || p.steps.length > 0);

  return (
    <div className="ec-fade">
      <Header title="Manual de procedimientos" subtitle="Referencia rápida por área de trabajo." />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, maxWidth: 360 }}>
        <Search size={14} color={C.muted} />
        <input className="ec-input" placeholder="Buscar en el manual…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="ec-card" style={{ padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Nico Cavallo</div>
          <div style={{ fontSize: 12, color: C.muted }}>Ubicación del estudio</div>
        </div>
        <a href="https://maps.google.com/?q=-34.891102,-56.109699" target="_blank" rel="noreferrer" className="ec-btn-ghost" style={{ textDecoration: "none" }}>Ver en Google Maps</a>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((p) => {
          const Icon = p.icon;
          const isOpen = openId === p.id || !!q;
          return (
            <div key={p.id} className="ec-card">
              <button onClick={() => setOpenId(isOpen && !q ? null : p.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon size={17} color={C.brass} />
                  <span className="ec-serif" style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
                  <span style={{ fontSize: 11.5, color: C.muted }}>({p.steps.length} pasos)</span>
                </div>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {isOpen && (
                <ol style={{ margin: 0, padding: "0 20px 16px 40px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.steps.map((s, idx) => (
                    <li key={idx} style={{ fontSize: 13.5, lineHeight: 1.55 }}>{s}</li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
