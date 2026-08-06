import { useCallback, useEffect, useState } from "react";
import { appSettingsApi } from "../lib/api.js";

export function useAppSettings({ notify } = {}) {
  const [simpleMode, setSimpleMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appSettingsApi
      .get()
      .then((row) => setSimpleMode(row.simple_mode))
      .catch((err) => notify?.("error", `No se pudo cargar la configuración: ${err.message}`))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
