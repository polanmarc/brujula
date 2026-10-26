CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  moodle_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  description text,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'medium',
  due_date date,
  due_time time,
  status text NOT NULL DEFAULT 'todo',
  recurrence text NOT NULL DEFAULT 'none',
  source_uid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  uid text NOT NULL,
  title text NOT NULL,
  description text,
  course text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  url text,
  source text NOT NULL DEFAULT 'moodle',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, uid)
);
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quick_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  moodle_ics_url text,
  moodle_base_url text,
  last_moodle_sync timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects, public.tasks, public.calendar_events, public.notes, public.quick_links TO authenticated;
GRANT ALL ON public.subjects, public.tasks, public.calendar_events, public.notes, public.quick_links, public.user_settings TO service_role;
-- settings hold the private Moodle URL: browser may write but only read non-secret columns
GRANT INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT (user_id, moodle_base_url, last_moodle_sync, updated_at) ON public.user_settings TO authenticated;

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_subjects ON public.subjects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_tasks ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_events ON public.calendar_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_notes ON public.notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_links ON public.quick_links FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_settings ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX tasks_user_due ON public.tasks(user_id, due_date);
CREATE INDEX events_user_start ON public.calendar_events(user_id, starts_at);