-- Auto-create a task for every deadline/exam imported from a "deadlines" calendar feed (Moodle…).

-- Set once the sync has created the event's task. Event upserts never touch it, so a task the
-- user deletes is not recreated on the next sync.
ALTER TABLE public.calendar_events ADD COLUMN task_created_at timestamptz;

-- Mark events that were already turned into a task by hand ("Convertir en tarea").
UPDATE public.calendar_events e SET task_created_at = now()
WHERE EXISTS (SELECT 1 FROM public.tasks t WHERE t.user_id = e.user_id AND t.source_uid = e.uid);

-- One task per calendar event and user: unlink (never delete) extra copies, keeping the oldest.
UPDATE public.tasks t SET source_uid = NULL
FROM (
  SELECT id, row_number() OVER (PARTITION BY user_id, source_uid ORDER BY created_at, id) AS n
  FROM public.tasks WHERE source_uid IS NOT NULL
) d
WHERE d.id = t.id AND d.n > 1;

-- Makes the sync idempotent even when two runs overlap (page load + "Sincronizar" button).
-- NULLs are distinct, so manual tasks without source_uid are unaffected.
CREATE UNIQUE INDEX tasks_user_source_uid ON public.tasks(user_id, source_uid);
