import { useCallback, useRef, useState } from "react";

const MAX_VISIBLE_TOASTS = 4;

/* Small toast queue for surfacing async success/error feedback across the app.
   Identical messages are deduped (just re-armed) instead of stacking, since a
   handful of collections can fail with the same underlying cause at once —
   e.g. the Supabase schema not being applied yet fails every table's initial
   load in parallel. Only the most recent MAX_VISIBLE_TOASTS are shown. */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef({});

  const notify = useCallback((type, message, onUndo) => {
    // Undo toasts (delete confirmations) are never deduped — each is tied to
    // a specific row and its own undo() closure — and get a fixed 5s window
    // matching removeRowWithUndo's deferred-delete timer.
    if (onUndo) {
      const id = nextId.current++;
      timers.current[id] = setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.id !== id));
      }, 5000);
      setToasts((prev) => [...prev, { id, type, message, onUndo }].slice(-MAX_VISIBLE_TOASTS));
      return;
    }
    setToasts((prev) => {
      const existing = prev.find((t) => t.type === type && t.message === message);
      if (existing) {
        clearTimeout(timers.current[existing.id]);
        timers.current[existing.id] = setTimeout(() => {
          setToasts((cur) => cur.filter((t) => t.id !== existing.id));
        }, type === "error" ? 6000 : 3000);
        return prev;
      }
      const id = nextId.current++;
      timers.current[id] = setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.id !== id));
      }, type === "error" ? 6000 : 3000);
      return [...prev, { id, type, message }].slice(-MAX_VISIBLE_TOASTS);
    });
  }, []);

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, notify, dismiss };
}
