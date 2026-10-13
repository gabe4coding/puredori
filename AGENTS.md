# puredori

A Claude Code plugin that shapes AI work into small PRs a person can review. It sends short rules at session start
(`hooks/rules.md`), offers two skills (`pr-plan`, `pr-write`), and denies a PR body without `## Intent` and
`## Evidence`. The whole repo is the plugin (marketplace source `./`).

## Read first, by task
- Any change to code, tests, skills, rules or docs → `CODING_STANDARDS.md`.
- The PR gate: what a command writes and where its body is (pure, no `$`) → `hooks/gate.ts`. The hook that uses it
  → `hooks/register.ts`. The session-start rules → `hooks/rules.md`, sent by the command hook in `hooks/hooks.json`.
- The skills → `skills/*/SKILL.md`.
- What real Claude Code does with the plugin → `.claude/skills/verify/` (`drive.mjs` drives any prompts in a new git
  repo with a fake `gh` and prints the evidence). Run it before you trust an assumption about the engine.
- The engine API (`$`, events, `claude-code/testing`) → `.claude-plugin/types/claude-code/index.d.ts`. Claude Code
  writes it when the plugin loads with `--plugin-dir`. It is not in git.

## Rules
- The rules and skills load in other people's sessions: each word costs tokens there. See "Model-facing text" in
  `CODING_STANDARDS.md`.
- Before every commit, do the verification loop in `CODING_STANDARDS.md`: `/simplify`, `/code-review`, the checks,
  then `/verify`.
