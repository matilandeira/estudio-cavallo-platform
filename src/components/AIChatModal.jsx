import React, { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, User as UserIcon } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { supabase } from "../lib/supabaseClient.js";

const SUGGESTED_PROMPTS = [
  "¿Qué escrituras se firman esta semana?",
  "¿Hay trámites atrasados?",
  "¿Cuántos autos están pendientes?",
  "¿Qué inmuebles están por firmarse?",
];

const GENERIC_ERROR = "No se pudo conectar con el asistente. Intentá nuevamente en unos segundos.";

const formatTime = (date) => date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });

/* Floating AI assistant: a round button bottom-right that opens a chat
   drawer. Queries /api/chat (see api/chat.js), a Vercel Serverless
   Function that grounds Claude's answers in a live Supabase summary. Only
   ever mounted for signed-in users (see AuthenticatedApp.jsx) — the
   session's access token is forwarded on every request so the backend can
   query Supabase under the same Row Level Security as this user. */
export default function AIChatModal() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: "user"|"assistant", content, at, isError? }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const history = [...messages, { role: "user", content, at: new Date() }];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: history.map(({ role, content: c }) => ({ role, content: c })) }),
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload || payload.error) {
        const message = payload?.message || GENERIC_ERROR;
        const detail = payload?.detail;
        if (detail) console.error(`api/chat (${payload?.error || res.status}):`, detail);
        const content = detail ? `${message}\n\nDetalle: ${detail}` : message;
        setMessages((prev) => [...prev, { role: "assistant", content, at: new Date(), isError: true }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: payload.reply || "…", at: new Date() }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: GENERIC_ERROR, at: new Date(), isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send();
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "Cerrar asistente" : "Abrir asistente IA"}
        style={{
          position: "fixed", bottom: 22, right: 22, zIndex: 200,
          width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer",
          background: C.ink, color: C.brass, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,.28)",
        }}
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {open && (
        <div
          className="ec-card ec-fade"
          style={{
            position: "fixed", bottom: 86, right: 22, zIndex: 200,
            width: 380, maxWidth: "calc(100vw - 32px)", height: 540, maxHeight: "calc(100vh - 120px)",
            display: "flex", flexDirection: "column", overflow: "hidden", background: C.white,
            boxShadow: "0 12px 32px rgba(0,0,0,.24)",
          }}
        >
          <div style={{ background: C.ink, color: C.white, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color={C.brass} />
              <span className="ec-serif" style={{ fontWeight: 700, fontSize: 15 }}>Asistente IA</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.brassLight, display: "flex" }}>
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: C.paper3 }}>
            {messages.length === 0 && (
              <div>
                <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                  Preguntame sobre autos, documentos, inmuebles y trámites del estudio. Algunas ideas:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="ec-chip"
                      style={{ textAlign: "left", padding: "8px 12px", borderRadius: 6, width: "100%" }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, maxWidth: "88%", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                  <div
                    style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: m.role === "user" ? C.bottle : C.ink, color: m.role === "user" ? C.white : C.brass,
                    }}
                  >
                    {m.role === "user" ? <UserIcon size={12} /> : <Sparkles size={12} />}
                  </div>
                  <div
                    style={{
                      padding: "8px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
                      background: m.role === "user" ? C.bottle : m.isError ? "#F3DDE0" : C.white,
                      color: m.role === "user" ? C.white : m.isError ? C.wax : C.ink,
                      border: m.role === "user" ? "none" : `1px solid ${C.line}`,
                    }}
                  >
                    {m.content}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: C.muted, marginTop: 3, marginRight: m.role === "user" ? 28 : 0, marginLeft: m.role === "user" ? 0 : 28 }}>
                  {formatTime(m.at)}
                </span>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 12.5, marginLeft: 28 }}>
                <Loader2 size={13} className="ec-spin" /> Pensando…
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
            <input
              className="ec-input"
              placeholder="Escribí tu pregunta…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="ec-btn" disabled={loading || !input.trim()} style={{ padding: "8px 12px", flexShrink: 0 }}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
