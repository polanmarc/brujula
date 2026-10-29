-- Multi-user product: per-user integrations, profiles, grades, timetable, attendance,
-- study sessions, finances, study groups, push subscriptions and AI usage.

-- ---------- Profiles (one per account; drives onboarding and preferences) ----------
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  university text,
  degree text,
  onboarded boolean NOT NULL DEFAULT false,
  hidden_widgets text[] NOT NULL DEFAULT '{}',
  absence_limit_pct integer NOT NULL DEFAULT 20 CHECK (absence_limit_pct BETWEEN 0 AND 100),
  weekly_goal_minutes integer NOT NULL DEFAULT 600 CHECK (weekly_goal_minutes >= 0),
  digest_email boolean NOT NULL DEFAULT false,
  feed_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- existing accounts skip onboarding
INSERT INTO public.profiles (user_id, display_name, onboarded)
SELECT id, split_part(email, '@', 1), true FROM auth.users
ON CONFLICT DO NOTHING;

-- ---------- Calendar sources (any iCal feed: Moodle, Canvas, Classroom, timetable…) ----------
CREATE TABLE public.calendar_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  kind text NOT NULL DEFAULT 'deadlines' CHECK (kind IN ('deadlines', 'classes', 'other')),
  ics_url text,
  last_sync timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_sources_user ON public.calendar_sources(user_id);

INSERT INTO public.calendar_sources (user_id, name, kind, ics_url, last_sync)
SELECT user_id, 'Moodle', 'deadlines', moodle_ics_url, last_moodle_sync
FROM public.user_settings WHERE moodle_ics_url IS NOT NULL;

ALTER TABLE public.calendar_events
  ADD COLUMN source_id uuid REFERENCES public.calendar_sources(id) ON DELETE CASCADE,
  ADD COLUMN kind text NOT NULL DEFAULT 'deadline' CHECK (kind IN ('deadline', 'exam', 'class', 'event'));
UPDATE public.calendar_events e SET source_id = s.id
FROM public.calendar_sources s
WHERE s.user_id = e.user_id AND e.source = 'moodle';

DROP TABLE public.user_settings;
DROP FUNCTION IF EXISTS public.is_app_owner();

-- ---------- Google accounts (Gmail OAuth tokens, encrypted by the server; never readable by clients) ----------
CREATE TABLE public.google_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  refresh_token_enc text NOT NULL,
  access_token_enc text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Subjects, tasks, notes: richer fields ----------
ALTER TABLE public.subjects
  ADD COLUMN teacher text,
  ADD COLUMN room text,
  ADD COLUMN credits numeric(4,1),
  ADD COLUMN absence_limit integer CHECK (absence_limit >= 0),
  ADD COLUMN pass_grade numeric(4,2) NOT NULL DEFAULT 5,
  ADD COLUMN target_grade numeric(4,2);

ALTER TABLE public.notes
  ADD COLUMN title text NOT NULL DEFAULT '',
  ADD COLUMN subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

-- ---------- Study groups (shared tasks) ----------
CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  invite_code text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  display_name text NOT NULL DEFAULT '',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_group_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated;

-- the creator joins automatically
CREATE OR REPLACE FUNCTION public.add_group_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, display_name)
  VALUES (NEW.id, NEW.owner_id, COALESCE((SELECT display_name FROM public.profiles WHERE user_id = NEW.owner_id), ''));
  RETURN NEW;
END;
$$;
CREATE TRIGGER study_groups_owner AFTER INSERT ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public.add_group_owner();

-- joining only works with the invite code
CREATE OR REPLACE FUNCTION public.join_group(code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT id INTO gid FROM public.study_groups WHERE invite_code = trim(code);
  IF gid IS NULL THEN RAISE EXCEPTION 'Código de invitación no válido'; END IF;
  INSERT INTO public.group_members (group_id, user_id, display_name)
  VALUES (gid, auth.uid(), COALESCE((SELECT display_name FROM public.profiles WHERE user_id = auth.uid()), ''))
  ON CONFLICT DO NOTHING;
  RETURN gid;
END;
$$;
REVOKE ALL ON FUNCTION public.join_group(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_group(text) TO authenticated;

ALTER TABLE public.tasks
  ADD COLUMN parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN estimate_minutes integer CHECK (estimate_minutes > 0),
  ADD COLUMN kind text NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'deliverable', 'exam')),
  ADD COLUMN group_id uuid REFERENCES public.study_groups(id) ON DELETE CASCADE;
CREATE INDEX tasks_parent ON public.tasks(parent_id);
CREATE INDEX tasks_group ON public.tasks(group_id);

-- ---------- Grades (evaluation criteria with weights) ----------
CREATE TABLE public.grade_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  weight numeric(5,2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
  grade numeric(5,2) CHECK (grade >= 0),
  max_grade numeric(5,2) NOT NULL DEFAULT 10 CHECK (max_grade > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX grade_items_subject ON public.grade_items(user_id, subject_id);

-- ---------- Weekly timetable and attendance ----------
CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text,
  CHECK (end_time > start_time)
);
CREATE INDEX class_sessions_user ON public.class_sessions(user_id, weekday);

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  UNIQUE (user_id, subject_id, date)
);

-- ---------- Study sessions (pomodoro / free timer) ----------
CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  minutes integer NOT NULL CHECK (minutes > 0 AND minutes <= 600),
  kind text NOT NULL DEFAULT 'pomodoro' CHECK (kind IN ('pomodoro', 'free'))
);
CREATE INDEX study_sessions_user ON public.study_sessions(user_id, started_at);

-- ---------- Student finances ----------
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  amount numeric(10,2) NOT NULL,
  category text NOT NULL DEFAULT 'otros',
  description text,
  date date NOT NULL DEFAULT current_date,
  recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user ON public.transactions(user_id, date);

-- ---------- Web Push subscriptions ----------
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- AI usage (per-user daily limit, server-only) ----------
CREATE TABLE public.ai_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  feature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_requests_user ON public.ai_requests(user_id, created_at);

-- ---------- Grants ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.grade_items, public.class_sessions,
  public.attendance, public.study_sessions, public.transactions, public.push_subscriptions,
  public.study_groups, public.group_members TO authenticated;
-- iCal URLs are private: the browser can list/rename/delete sources but never read or write the URL
GRANT SELECT (id, user_id, name, color, kind, last_sync, last_error, created_at) ON public.calendar_sources TO authenticated;
GRANT UPDATE (name, color, kind) ON public.calendar_sources TO authenticated;
GRANT DELETE ON public.calendar_sources TO authenticated;
GRANT ALL ON public.profiles, public.calendar_sources, public.google_accounts, public.grade_items,
  public.class_sessions, public.attendance, public.study_sessions, public.transactions,
  public.push_subscriptions, public.study_groups, public.group_members, public.ai_requests TO service_role;

-- ---------- Row level security ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_profile ON public.profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_sources ON public.calendar_sources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_grades ON public.grade_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_sessions ON public.class_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_attendance ON public.attendance FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_study ON public.study_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_transactions ON public.transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_push ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- google_accounts and ai_requests: no policies → only the service role can touch them

CREATE POLICY groups_read ON public.study_groups FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_group_member(id));
CREATE POLICY groups_create ON public.study_groups FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY groups_owner_update ON public.study_groups FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY groups_owner_delete ON public.study_groups FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY members_read ON public.group_members FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY members_leave ON public.group_members FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
);

-- tasks: own tasks, plus tasks shared with a group you belong to
DROP POLICY own_tasks ON public.tasks;
CREATE POLICY tasks_access ON public.tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(group_id)))
  WITH CHECK (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(group_id)));
