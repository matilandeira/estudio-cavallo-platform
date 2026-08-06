import React from "react";
import { C, StyleSheet } from "./lib/theme.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { LoadingBlock } from "./components/SharedUI.jsx";
import Login from "./components/Login.jsx";
import AuthenticatedApp from "./components/AuthenticatedApp.jsx";

/* Pure auth gate: while the session check is in flight, show a spinner; with
   no session, show only the login screen; only once a session is confirmed
   does <AuthenticatedApp/> get mounted — which is what actually calls the
   Supabase data hooks. Nothing below ever renders (or fetches) without a
   valid, signed-in session. */
export default function App() {
  const { session, user, loading: authLoading, signOut } = useAuth();

  return (
    <div className="ec-root" style={{ minHeight: "100vh", background: C.paper }}>
      <StyleSheet />
      {authLoading ? (
        <LoadingBlock label="Verificando sesión…" />
      ) : !session ? (
        <Login />
      ) : (
        <AuthenticatedApp user={user} signOut={signOut} />
      )}
    </div>
  );
}
