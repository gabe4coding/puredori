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
  - `node tests/docs.check.mjs`: the rules in [Docs](#docs).
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

## Docs
User docs are `README.md` and `docs/*.mdx`. They are for humans first: a developer who installs the plugin or
changes it. Out of this set: `AGENTS.md`, this file and the model-facing text above.
`tests/docs.check.mjs` checks the rules marked `[test]`.

### Content
- `README.md` stays a short landing page: pitch, quick start, one example, links. User docs live in `docs/*.mdx`.
  When behaviour changes, change the matching page (`docs/usage.mdx` for the skills, rules and gate).
- The code and the skills are the source of truth. Check every behaviour in `hooks/` and `skills/` before you
  write it.
- Lead with what the reader wants to do and a short example. Reference tables come after.
- Keep only facts that change what a user does or understands. Leave out function names unless the user types
  them, and history.
- The banner (`docs/assets/banner.svg`, 1280x400) and the logo use one accent color, `#FF5A36`, on `#0A0A0A`.

### Format
- Each `docs/*.mdx` starts with front matter (`title`, one-sentence `description`) and an H1 equal to the title.
  `[test]`
- Plain Markdown, no JSX, imports or comments, so GitHub renders them. Keep `<…>` and `{…}` inside backticks or
  code blocks: MDX reads them as JSX. `[test]`
- Relative links use the `.mdx` name and the GitHub heading slug. When you rename a heading, fix every link to it.
  `[test: every link and anchor must resolve]`

### Language: ASD-STE100 (Simplified Technical English)
Technical names are allowed: tool names, options, file and product names.
- Instructions: imperative, one instruction per sentence, at most 20 words, condition first ("If X, do Y").
- Descriptions: at most 25 words per sentence `[test]`, one topic per sentence, at most 6 sentences per paragraph.
- Active voice, simple present. "can" for possibility, "must" for a requirement, "do not" for a prohibition.
- No should/may/might/would/could, contractions, semicolons, e.g./i.e./etc., or filler words (just, simply,
  easily) `[test]`. No -ing forms where a plain verb works. Keep the articles.
- Vertical lists for three or more items, numbered lists when order matters. A warning starts with the
  instruction, then gives the reason.
- One word for one meaning, in all docs:

| Term | Meaning | Do not use |
| --- | --- | --- |
| plugin | PuReDoRi as Claude Code installs it. `puredori` in commands. | mod, extension |
| rules | The text in `hooks/rules.md` that Claude reads at session start | prompt, instructions |
| PR gate | The hook that stops a PR body without `## Intent` or `## Evidence` | guard, check, validator |
| stack | The PRs of one task, each on the branch of the step before it | chain, series |
| step | One PR of a stack, with one intent | phase, part |
| first PR | The PR of step 1. It holds the Story table. | root PR, parent PR |
| Story table | The plan of the stack, as a table at the end of the first PR | plan table, index |
| signal | A kind of change in the diff that the reading map lists: tests, config, migrations, public API, error handling | risk, hotspot |
| run output | Real output of the changed program: a log, a curl reply, a screenshot, numbers | test result, proof |
