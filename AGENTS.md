# gAR-den

## Cursor Cloud specific instructions

### Superpowers plugin

The [`superpowers`](https://github.com/obra/superpowers) Cursor plugin (skills library for TDD, systematic debugging, brainstorming, planning, code review, etc.) is vendored into this repo at `.cursor/plugins/superpowers/` as the durable source of truth. Pinned to upstream version `6.1.1`.

- The plugin is a self-contained Cursor plugin: `.cursor-plugin/plugin.json` (manifest), `skills/` (14 skills, each a `SKILL.md`), and `hooks/` (a `sessionStart` hook that injects the `using-superpowers` skill at session start).
- Cursor does not auto-load plugins committed in the repo tree. To activate it, the on-disk plugin is loaded via Cursor's documented local-plugin path by symlinking the repo copy into `~/.cursor/plugins/local/superpowers`. The update script recreates this symlink (idempotent, guarded on the repo dir existing), so future sessions load it automatically after startup. Because it is a symlink to the committed copy, there is a single source of truth and no duplicated skill content.
- The `sessionStart` hook (`hooks/session-start`) branches on `CURSOR_PLUGIN_ROOT`; when set it emits `{"additional_context": ...}` (Cursor's expected snake_case field). You can smoke-test it with: `cd .cursor/plugins/superpowers && CURSOR_PLUGIN_ROOT="$PWD" ./hooks/run-hook.cmd session-start`.
- Skills are invocable in chat via `/skill-name` (e.g. `/brainstorming`) and are auto-triggered by the agent when relevant. Each skill folder name must match the `name:` in its `SKILL.md` frontmatter.
- The plugin activates for a session at startup; a plugin change made mid-session (e.g. re-symlinking) is not picked up by the already-running agent context until the next session.
