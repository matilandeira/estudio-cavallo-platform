import { useCallback, useEffect, useState } from "react";
import { RECURRING_TASKS } from "../lib/constants.js";
import { recurringTaskAssigneesApi, recurringTaskCompletionsApi } from "../lib/api.js";

export function periodKeyFor(freq) {
  const d = new Date();
  if (freq === "daily") return d.toISOString().slice(0, 10);
  if (freq === "monthly") return d.toISOString().slice(0, 7);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export function useRecurringTasks({ notify } = {}) {
  const [completions, setCompletions] = useState({}); // task_id -> period_key
  const [assigneeOverrides, setAssigneeOverrides] = useState({}); // task_id -> string[]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([recurringTaskCompletionsApi.list(), recurringTaskAssigneesApi.list()])
      .then(([completionRows, assigneeRows]) => {
        setCompletions(Object.fromEntries(completionRows.map((r) => [r.task_id, r.period_key])));
        setAssigneeOverrides(Object.fromEntries(assigneeRows.map((r) => [r.task_id, r.assignees])));
      })
      .catch((err) => notify?.("error", `No se pudieron cargar las tareas recurrentes: ${err.message}`))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDone = useCallback((task) => completions[task.id] === periodKeyFor(task.freq), [completions]);

  const toggle = useCallback(
    async (task) => {
      const key = periodKeyFor(task.freq);
      const wasDone = completions[task.id] === key;
      setCompletions((prev) => {
        const next = { ...prev };
        if (wasDone) delete next[task.id];
        else next[task.id] = key;
        return next;
      });
      try {
        if (wasDone) await recurringTaskCompletionsApi.clear(task.id);
        else await recurringTaskCompletionsApi.setCompleted(task.id, key);
      } catch (err) {
        setCompletions((prev) => ({ ...prev, [task.id]: wasDone ? key : undefined }));
        notify?.("error", `No se pudo guardar el estado de la tarea: ${err.message}`);
      }
    },
    [completions, notify]
  );

  const assigneesFor = useCallback((task) => assigneeOverrides[task.id] || task.assignees, [assigneeOverrides]);

  const setAssignees = useCallback(
    async (taskId, list) => {
      const previous = assigneeOverrides[taskId];
      setAssigneeOverrides((prev) => ({ ...prev, [taskId]: list }));
      try {
        await recurringTaskAssigneesApi.set(taskId, list);
      } catch (err) {
        setAssigneeOverrides((prev) => ({ ...prev, [taskId]: previous }));
        notify?.("error", `No se pudieron guardar los responsables: ${err.message}`);
      }
    },
    [assigneeOverrides, notify]
  );

  return { tasks: RECURRING_TASKS, isDone, toggle, assigneesFor, setAssignees, loading };
}
