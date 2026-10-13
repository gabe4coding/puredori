# Coding standards

Rules for changing code, tests, skills, rules and docs in this repo. `[test: x]` marks a rule that a test enforces;
the others rely on discipline.

## Code
- `hooks/` is the hooks module that Claude Code loads (`hooks/hooks.json`). Pure helpers go in `hooks/gate.ts`, with
  no `$`, so tests call them directly. Anything that uses `$` goes in `hooks/register.ts`.
- Send text for the model at session start through the SessionStart command hook in `hooks/hooks.json`, not through
  `prompt.compose` or `prompt.section`: the built-in security module bypasses those handlers of a plugin module
  (debug log: `prompt.section bypassed by cc-plugin-sec-default`).
- A guard hook (`tool.call`) has a `.catch`. If the guard fails before it called `next`, it denies with a message
  that names the skill to use by hand.

## Tests and commits
- Before every commit, do the verification loop in this order. If a step changes code, start again at step 1.
  1. `/simplify`: the built-in Claude Code skill. It cleans up the diff (reuse, simplification, efficiency) and
     applies the fixes. Run it first, so the later steps see its edits too.
  2. `/code-review`: the built-in Claude Code skill. It looks for correctness bugs in the diff. Fix each finding
     that it confirms, or say in the commit why you keep the code.
  3. The checks below.
  4. `/verify`: the built-in Claude Code skill. It drives the change end to end and observes the behaviour. Run it
     after a plugin change (see [Plugin](#plugin)). Skip it when the diff touches only tests or docs: there is
     nothing to drive. It reads the project recipe in `.claude/skills/verify/` (`SKILL.md` and `drive.mjs`): real
     Claude Code with the plugin, in a new git repo with a fake `gh`. If the recipe fails or misses a step, fix it.
- The checks. `[test: CI runs them]`
  - `claude plugin validate .`: the manifests and the module, as the engine reads them.
  - `claude plugin test .`: the hooks against a fake host (`tests/*.test.ts`).
  - `node tests/version.check.mjs`: the version rule below. CI runs it on each pull request.
- Write a test for each behaviour change of the hooks.
- CI (`.github/workflows/test.yml`) pins the Claude Code version for `claude plugin test .`, and a weekly job runs
  the tests with the newest release.
- Never put real prompts, PR bodies, company names, user ids or tokens in tests, probes or docs: this repo is public.

## Plugin
- A plugin change is a change under `hooks/`, `skills/` or to `.claude-plugin/plugin.json`. After a plugin change,
  bump `version` in `.claude-plugin/plugin.json`: Claude Code caches a plugin per version.
  `[test: CI runs tests/version.check.mjs on each pull request]`

## Model-facing text
The text a model reads is the product: `hooks/rules.md`, the skills (`skills/*/SKILL.md` and their reference
files), and the denial messages in `hooks/register.ts`.
- Every sentence must change what the model does. Remove a sentence that the model follows without it, and facts
  it cannot act on.
- Keep the reason for a rule that is not obvious: the model applies the rule to cases that the text does not name.
- `hooks/rules.md` and the skill descriptions load in every session: each word costs tokens in every session. A
  skill body loads only when the skill runs. Put detail that only some runs need in a reference file that the skill
  names, so the model reads it only then.
- A denial message names the fix: the skill to load and the command to run again.
