import { useCallback, useEffect, useState } from "react";
import { appSettingsApi } from "../lib/api.js";

export function useAppSettings({ notify, enabled = true } = {}) {
  const [simpleMode, setSimpleMode] = useState(false);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    appSettingsApi
      .get()
      // `row` is null if the settings row isn't visible yet (e.g. RLS still
      // catching up right after sign-in) — fall back to the default rather
      // than treating "nothing there yet" as an error.
      .then((row) => setSimpleMode(row?.simple_mode ?? false))
      .catch((err) => notify?.("error", `No se pudo cargar la configuración: ${err.message}`))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const toggleSimpleMode = useCallback(async () => {
    const next = !simpleMode;
    setSimpleMode(next); // optimistic
    try {
      await appSettingsApi.setSimpleMode(next);
    } catch (err) {
      setSimpleMode(!next);
      notify?.("error", `No se pudo guardar la configuración: ${err.message}`);
    }
  }, [simpleMode, notify]);

  return { simpleMode, loading, toggleSimpleMode };
}
