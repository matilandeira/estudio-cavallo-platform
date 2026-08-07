import React, { useEffect, useState } from "react";
import { X, Loader2, AlertCircle, Lock } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { supabase } from "../lib/supabaseClient.js";

const MIN_LENGTH = 6;

/* "Cambiar contraseña" modal, opened from the user email in the header (see
   AuthenticatedApp.jsx). Uses supabase.auth.updateUser({ password }), which
   updates the currently signed-in user's own credentials against the
   already-active session — no re-entering the current password, no admin
   key involved (unlike scripts/create-staff-users.js, which needs the
   service role key specifically because it creates *other* people's
   accounts; this only ever touches the caller's own). */
export default function ChangePasswordModal({ open, onClose, notify }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirm("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (password.length < MIN_LENGTH) {
      setError(`La contraseña tiene que tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (authError) {
      setError(
        authError.message === "New password should be different from the old password."
          ? "La nueva contraseña tiene que ser distinta de la actual."
          : "No se pudo actualizar la contraseña. Intentá nuevamente."
      );
      return;
    }

    notify?.("success", "¡Contraseña actualizada con éxito!");
    onClose();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(30,42,36,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ec-card ec-fade" style={{ width: "100%", maxWidth: 380, padding: "22px 26px", background: C.white }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span className="ec-serif" style={{ fontWeight: 700, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={16} color={C.brass} /> Cambiar contraseña
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex" }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600 }}>
              Nueva contraseña
            </label>
            <input
              className="ec-input"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Al menos 6 caracteres"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600 }}>
              Confirmar nueva contraseña
            </label>
            <input
              className="ec-input"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repetí la contraseña"
            />
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#F3DDE0", color: C.wax, borderRadius: 4, padding: "9px 11px", fontSize: 12.5 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="ec-btn-ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button type="submit" className="ec-btn" disabled={submitting}>
              {submitting ? (<><Loader2 size={14} className="ec-spin" /> Guardando…</>) : "Guardar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
