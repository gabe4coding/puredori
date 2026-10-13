# pr-shape

A Claude Code plugin that shapes AI work into small PRs that a person can review.

A reviewer of an AI PR needs the intent, the drift from the intent, the decisions and real run output. The reviewer samples the diff by mechanical signals, not by the agent's risk list. This plugin makes the agent plan for that before it writes code, and write the PR body in that shape.

## What it contains

| Part | Type | What it does |
|---|---|---|
| `pr-plan` | Skill | Confirms the intent with you. Splits the work into a stack of small PRs, each with planned run evidence. Opens the first PR as a draft that holds the story. |
| `pr-write` | Skill | Writes the PR body: Intent, Drift, Decisions, Evidence, Reading map, Stack. A small diff gets Intent and Evidence only. |
| Rules | Hook (`SessionStart` command) | Adds short PR-shape rules (`hooks/rules.md`) to the context at the start of a session, and after `/clear` and compaction. |
| PR gate | Hook (`tool.call` on Bash) | Stops `gh pr create` and `gh pr edit --body` when the body has no `## Intent` or no `## Evidence` section. |

## Install

Type this at the prompt of a Claude Code terminal session:

```
/plugin install pr-shape --marketplace gabe4coding/pr-shape
```

Answer `y` to add the marketplace, then choose the user scope.

## Develop

```bash
claude --plugin-dir ~/Repositories/pr-shape
```

```bash
claude plugin validate ~/Repositories/pr-shape
```

```bash
claude plugin test ~/Repositories/pr-shape
```
