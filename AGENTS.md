<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Integrations (Moodle ICS, Gmail) run only in `createServerFn` handlers that call `is_app_owner()`; the app is single-owner (first auth user) so shared connector credentials never reach other accounts.
- The private Moodle ICS URL lives in `user_settings.moodle_ics_url`, which authenticated users cannot SELECT; read it only via the admin client in server code.
- Moodle events and tasks are merged in `buildAgenda`; a task with `source_uid` hides its matching event to avoid duplicates.
- Gmail access is read-only in code: never call send/modify/trash endpoints.
