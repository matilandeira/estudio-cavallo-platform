import React, { useState } from "react";
import { Stamp, Loader2, AlertCircle } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { supabase } from "../lib/supabaseClient.js";

/* Supabase Auth error messages come back in English; translate the common ones. */
function translateAuthError(message) {
  const map = {
    "Invalid login credentials": "Correo electrónico o contraseña incorrectos.",
    "Email not confirmed": "Todavía no confirmaste tu correo electrónico.",
    "Too many requests": "Demasiados intentos. Esperá un momento y volvé a intentar.",
  };
  return map[message] || "No se pudo iniciar sesión. Intentá nuevamente.";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || submitting) return;
    setSubmitting(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError(translateAuthError(authError.message));
      setSubmitting(false);
    }
    // On success, useAuth's onAuthStateChange listener picks up the new
    // session and App.jsx swaps this screen out — nothing else to do here.
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="ec-card ec-fade" style={{ width: "100%", maxWidth: 380, padding: "36px 32px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Stamp size={24} color={C.brass} />
          </div>
          <div className="ec-serif" style={{ fontSize: 21, fontWeight: 700, color: C.ink }}>Estudio Cavallo</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: ".04em", textTransform: "uppercase" }}>Centro de Operaciones</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600 }}>
              Correo electrónico
            </label>
            <input
              className="ec-input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@estudiocavallo.com"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600 }}>
              Contraseña
            </label>
            <input
              className="ec-input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#F3DDE0", color: C.wax, borderRadius: 4, padding: "9px 11px", fontSize: 12.5 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="ec-btn" disabled={submitting} style={{ justifyContent: "center", marginTop: 6, padding: "10px 14px" }}>
            {submitting ? (
              <>
                <Loader2 size={15} className="ec-spin" /> Ingresando…
              </>
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>

        <div style={{ marginTop: 22, textAlign: "center", fontSize: 11.5, color: C.muted }}>
          Acceso exclusivo para el equipo del estudio.
        </div>
      </div>
    </div>
  );
}
