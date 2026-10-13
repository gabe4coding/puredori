---
name: verify
description: Project recipe for /verify in puredori. Drive the plugin in real headless Claude Code in a new git repo with a fake gh, using drive.mjs, then judge by the rules sent at session start, the skills loaded, the PR gate's denials and the PR bodies that reached gh. Use when you verify a change to hooks/, skills/ or .claude-plugin/plugin.json.
---

# Verify puredori

The surface is the agent: real Claude Code with this plugin loaded from the repo (`--plugin-dir`, shown as
`puredori@inline` in the debug log). The plugin sends rules at session start, offers two skills, and denies a
`gh pr create` or `gh pr edit --body` without `## Intent` and `## Evidence`. A docs-only or tests-only diff has no
surface: report SKIP.

`drive.mjs` (next to this file) runs one session per call and prints the evidence as JSON. Each run gets its own
folder with a git repo (`main`, and `add-farewell` one commit ahead, both pushed to a local bare `origin`) and
`fake-gh.mjs` first on PATH as `gh`. A run never reaches GitHub. Your user settings and installed plugins stay out,
but managed settings still apply.

## Run

```bash
node .claude/skills/verify/drive.mjs run --prompts .claude/skills/verify/probes/gate.json
node .claude/skills/verify/drive.mjs run 'Implement X. It will end in a PR.' 'Yes, go ahead.'
node .claude/skills/verify/drive.mjs clean <dir>          # after you read the evidence
```

Put a prompt that names `gh pr create` in a JSON file and pass `--prompts`: a gate older than 0.1.2 in your own
session denies a command line that only names it. Runs are independent: start several as background jobs. One run with Haiku costs
about $0.01. `node .claude/skills/verify/drive.mjs` prints the options. `--state <gh-state.json>` starts with PRs
that exist, for example a stack: the format is the `gh-state.json` of an earlier run.

`run` prints:

| Field | What it shows |
| --- | --- |
| `turns` | Each prompt with its reply. `totalCostUsd` counts the whole session so far. |
| `rulesSent` | `true` when the SessionStart hook sent `hooks/rules.md`. |
| `skills` | The skills Claude loaded, in order. |
| `toolUses`, `toolResults` | What Claude called and got (results cut to 800 characters). |
| `gateDenials` | The PR gate's denials, as Claude read them. |
| `gh` | Each call to the fake gh: `argv`, and `body` when it read a PR body. |
| `prs` | The PRs at the end of the run: title, body, base, head, draft, state. |
| `pluginLog` | The engine's debug lines about the plugin: a module that did not load, a hook that failed or was bypassed. |

## Probes

The `probes/` folder holds prompt files. Each is a JSON array of prompts.

- `gate.json`: a body without sections. Expect one `gateDenials` entry and no `gh` call.
- `write.json`: open a PR that adds a `package.json` (config) and an exported function, so not small. Expect `skills`
  to hold `puredori:pr-write`, a `Read` of `references/full-body.md`, and a `gh` body with `## Reading map`. Run it
  with `--model sonnet` (about $0.20): Haiku calls every tiny diff small and skips the signal check.
- `small.json`: open a PR for a one-line comment. Expect `puredori:pr-write`, no `Read` of the reference, and a `gh`
  body with only `## Intent` and `## Evidence`.
- Stack probes, each with `--state probes/<name>-state.json` (the driver puts the branches of its open PRs on
  `origin`):
  - `stack.json`: open step 3 while step 2 is merged but its row says open. Expect one `gh pr edit 1` and Story rows
    `#2 (merged)`, `#3 (open)`.
  - `stack-closed.json`: the first PR is merged. Expect the new PR and no `gh pr edit 1`.
  - `stack-same.json`: update step 2's body; the Story is already right. Expect `gh pr edit 2` and no `gh pr edit 1`.
- `mention.json`: a commit message that names `gh pr create --body`. Expect the commit in `toolResults` and no
  `gateDenials`: only a command that runs counts.
- `plan.json`: code work that ends in a PR. Expect `puredori:pr-plan`, a reply that asks to confirm the intent, and
  no file written.
- For a skill change, drive the path that the change touches. Add a probe file when the path is not covered.

## Gotchas

- The session cannot ask questions (`AskUserQuestion` is off): it asks in its reply. Send the answer as the next
  prompt.
- Only the tools in `ALLOW` (`drive.mjs`) run. Anything else is denied and shows in `toolResults`. A command with
  `$(...)` or a variable is denied too.
- The fake gh knows only the commands in its header comment, and ignores `--jq`. If a skill needs more, add it to
  `fake-gh.mjs`.
- Claude is a model. If a step did not happen, run again before you call it a failure.
