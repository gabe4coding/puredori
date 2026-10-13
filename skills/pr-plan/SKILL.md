---
name: pr-plan
description: Use at the start of code work that will end in one or more PRs — "implement", "build", "add", "fix", "refactor", "migrate", a ticket or a plan to execute. Confirms the intent with the user, splits the work into a stack of small PRs, and names the real run evidence for each step. Skip for a one-line fix.
---

# pr-plan

Why: the user checks the plan before the code and the behavior after it; the diff in the middle is sampled, not read. The plan fixes the shape of the diff, which no PR text can fix later.

## 1. Intent

Write what was asked in 1–2 sentences the user can confirm: not the ticket restated, not a list of files. Do not write code before the user confirms it.

## 2. Steps

Split the work into a stack of PRs. Each step:

- Has one intent and a small diff (about 100 changed lines).
- Has real run output you can name: a screenshot, curl, log, recording, numbers before and after. Tests are not run output. If you cannot name it, split the step. For refactors, concurrency, performance and migrations, split until each step is safe without proof (expand → migrate → contract).
- Keeps mechanical changes (rename, move, format, generated code, dependency bump) in a step of their own.

A small change is one step. Do not invent steps to fill the table.

## 3. Decisions

Ask now about the choices that change what to do next. Make the small ones alone.

## 4. Story

```markdown
## Story

<intent, 1–2 sentences>

| # | Step | Evidence | PR |
|---|---|---|---|
| 1 | <step> | <how you will show it works> | planned |
```

## 5. Save the story in a draft PR

Why: until the first PR exists, the confirmed intent lives only in the chat, and a new session or a compaction can lose it.

When the user confirms the intent and the steps, before any code:

1. Branch from the default branch, `git commit --allow-empty -m "<step 1 title>"`, push. If the user has not allowed pushes in this session, ask first: the push and the draft PR are visible to the team.
2. Write the body to a file in the scratchpad: `## Intent` (the confirmed intent), `## Evidence` ("Pending: <planned evidence>"), then `## Story`.
3. `gh pr create --draft --base <default branch> --title "<step 1 title>" --body-file <path>`.

Each later step gets its own branch on top of the previous one. Open its PR only when its code is ready, with `--base <previous step's branch>`: the lookup below follows the bases.

## In a new session

The story is in the first PR of the stack: follow `gh pr view <n> --json baseRefName,body` down the bases until the base is the default branch.
