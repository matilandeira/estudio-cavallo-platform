import { useCallback, useEffect, useRef, useState } from "react";

/* Wraps a Supabase table API (see src/lib/api.js) into local React state.
   - `rows` always reflects what's on screen; mutations are applied optimistically.
   - `updateRow(id, patch, { debounce })` merges the patch into local state right away
     and, when `debounce` is set, waits briefly before sending it to Supabase — this
     keeps free-text inputs (onChange fires per keystroke) from hammering the network.
   - On any failed write, the change is rolled back locally and `notify("error", …)`
     is called so the UI can surface it. */
export function useSupabaseCollection(api, { notify, enabled = true } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const timers = useRef({});
  const pendingPatches = useRef({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.list();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      notify?.("error", `No se pudieron cargar los datos: ${err.message}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (!enabled) return;
    reload();
  }, [reload, enabled]);

  const insertRow = useCallback(
    async (row) => {
      try {
        const inserted = await api.insert(row);
        setRows((prev) => [inserted, ...prev]);
        return inserted;
      } catch (err) {
        notify?.("error", `No se pudo guardar: ${err.message}`);
        throw err;
      }
    },
    [api, notify]
  );

  const persist = useCallback(
    async (id, patch, previousRow) => {
      try {
        const updated = await api.update(id, patch);
        setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      } catch (err) {
        setRows((prev) => prev.map((r) => (r.id === id ? previousRow : r)));
        notify?.("error", `No se pudieron guardar los cambios: ${err.message}`);
      }
    },
    [api, notify]
  );

  const updateRow = useCallback(
    (id, patch, { debounce = false } = {}) => {
      let previousRow;
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          previousRow = r;
          return { ...r, ...patch };
        })
      );
      if (!debounce) {
        persist(id, patch, previousRow);
        return;
      }
      pendingPatches.current[id] = { patch: { ...(pendingPatches.current[id]?.patch || {}), ...patch }, previousRow: pendingPatches.current[id]?.previousRow || previousRow };
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => {
        const entry = pendingPatches.current[id];
        delete pendingPatches.current[id];
        if (entry) persist(id, entry.patch, entry.previousRow);
      }, 600);
    },
    [persist]
  );

  const removeRow = useCallback(
    async (id) => {
      let removed;
      setRows((prev) => {
        removed = prev.find((r) => r.id === id);
        return prev.filter((r) => r.id !== id);
      });
      try {
        await api.remove(id);
      } catch (err) {
        if (removed) setRows((prev) => [removed, ...prev]);
        notify?.("error", `No se pudo eliminar: ${err.message}`);
      }
    },
    [api, notify]
  );

  return { rows, setRows, loading, error, insertRow, updateRow, removeRow, reload };
}
