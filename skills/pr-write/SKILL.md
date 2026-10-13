---
name: pr-write
description: Use when writing or updating a PR body — before `gh pr create` or `gh pr edit --body`, or when the user says "open a PR", "create the PR", "write the PR description", "update the PR body". Writes a two-layer body (intent, drift, decisions, evidence, reading map, stack) sized to the diff.
---

# pr-write

Why: a noisy description is the first reason the user stops reading an AI PR. Each section below has a reader; anything else is noise. The person who wrote the prompt owns the result, so the body must give them enough to own it.

## Gather first

- Base and diff: `git diff --stat <base>...HEAD` and `git diff --name-status <base>...HEAD`.
- The story: from pr-plan in this session, or from the first PR of the stack (`gh pr view <n> --json body`). If there is none, ask the user for the intent in one sentence.
- Real run output from the work. If there is none, produce it now: run the app, curl the endpoint, take the screenshot, measure before and after. If you cannot, say so in Evidence. Never put "tests pass" in its place.

## Size

- Small (one concern, about 100 changed lines or less, no hits in the reading map): only `## Intent` (one line) and `## Evidence`.
- Otherwise: every section of the template.
- First PR of a stack: keep the `## Story` section that pr-plan put in the draft PR, at the end, with each step's PR link and status. Read it from the PR, not from memory. When step 1 is ready, mark the PR ready with `gh pr ready <n>`.

`## Intent` and `## Evidence` are always required: a hook blocks `gh pr create` without them.

## Template

```markdown
## Intent

<what was asked, 1–2 sentences the prompter can confirm>

<optional, big PRs only: one small visual — call tree diff, file tree diff, pseudocode or Mermaid; the smallest view that makes the point>

## Drift

<where the result differs from the intent: scope added, removed or changed. "None." if none>

## Decisions

- <only choices that change what to do next or make the next step less predictable>
- Door: <one-way | two-way> — <one line: can this be rolled back cheaply?>

## Evidence

**Before:** <real run output: screenshot, curl, log, numbers>
**After:** <the same, after the change>

## Reading map

<mechanical signals, rules below>

## Stack

Step <k>/<n> of <link to first PR>. Previous: <link or "none">. Next: <planned step or "none">.
```

## Reading map rules

Build it from the diff, not from your own idea of risk. The user samples the code here; if you choose where they look, the sample is worthless.
Under each signal with hits, list paths (with line ranges when useful). Leave out signals with no hits.

- **Tests changed or deleted:** test files with status D or M; removed or weakened assertions.
- **Config:** env, yaml, json, build files, CI, feature flags, infra.
- **Migrations / schema:** database migrations, schema files.
- **Public API:** routes, controllers, OpenAPI / proto / GraphQL schemas, exported types, events and messages.
- **Error handling:** diff lines that add or remove catch, throw, except, error returns, retries, timeouts.

Do not add a "risky areas" list of your own.

## Style

- No preamble, no "This PR…", no generic bullets, no list of changed files.
- Use the repo's domain words (`GLOSSARY.md` if present).
- Before you open the PR, delete every sentence the reviewer would skip.

## Open the PR

Write the body to a file in the scratchpad, then:

```bash
gh pr create --base <base> --title "<title>" --body-file <path>
```

Update an existing PR with `gh pr edit <n> --body-file <path>`. When a stack step opens, also update the Story table in the first PR.
