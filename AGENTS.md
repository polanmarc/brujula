## Architecture rules
- Integrations (Moodle ICS, Gmail) run only in `createServerFn` handlers that call `is_app_owner()`; the app is single-owner (first auth user) so shared connector credentials never reach other accounts.
- The one exception is the scheduled sync route `POST /api/cron/sync` in `src/server.ts`, a trusted path authenticated by the `CRON_SECRET` shared secret (`authenticateCronRequest`); it syncs every account with a configured ICS URL (the owner in practice) via `runMoodleSync` with the admin client.
- The Moodle sync core lives in `src/lib/moodle-sync.ts` (plain functions, admin client, explicit `user_id`) and is shared by the server fns and the cron route; `runMoodleSync` is throttled by `SYNC_THROTTLE_MS` unless `force` is passed.
- The private Moodle ICS URL lives in `user_settings.moodle_ics_url`, which authenticated users cannot SELECT; read it only via the admin client in server code.
- Moodle events and tasks are merged in `buildAgenda`; a task with `source_uid` hides its matching event to avoid duplicates.
- Gmail access is read-only in code: never call send/modify/trash endpoints.
