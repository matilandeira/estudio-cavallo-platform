import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

/* Tracks the current Supabase Auth session.
   `session` is `undefined` while the initial check is in flight, `null` once
   confirmed there's no active session, or the session object once signed in.
   Stays in sync afterward via onAuthStateChange (covers sign-in, sign-out,
   and token refresh in any browser tab). */
export function useAuth() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading: session === undefined,
    signOut: () => supabase.auth.signOut(),
  };
}
