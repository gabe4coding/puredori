---
name: pr-plan
description: Use at the start of code work that will end in one or more PRs — "implement", "build", "add", "fix", "refactor", "migrate", a ticket or a plan to execute. Confirms the intent with the user, splits the work into a stack of small PRs, and names the real run evidence for each step. Skip for a one-line fix.
---

# pr-plan

Why: the user reviews AI PRs with a small attention budget. They check the plan before the code and the behavior after it; the diff in the middle is sampled, not read. A plan made now fixes the shape of the diff, which no PR text can fix later.

## 1. Intent

Write what was asked in 1–2 sentences the user can confirm. Not the ticket restated, not a list of files.
Ask the user to confirm or correct it. Do not write code before they confirm.

## 2. Steps

Split the work into a stack of PRs. Each step:

- Has one intent and a small, focused diff.
- Has behavior you can show with real run output: screenshot, curl, log, recording, numbers before and after. If you cannot name the evidence, split the step smaller. For refactors, concurrency, performance and migrations, split until each step is safe without proof (for example expand → migrate → contract).
- Keeps mechanical changes (rename, move, format, generated code, dependency bump) in a step of their own, apart from logic.

A small change is one step. Do not invent steps to fill the table.

## 3. Decisions

List only the choices that change what to do next or make the next step less predictable. Ask the user about them now, not in the PR. Do not list the small decisions you can make alone.

## 4. Story

Write the plan in this format. It lives in the first PR of the stack; the other PRs link to that PR.

```markdown
## Story

<intent, 1–2 sentences>

| # | Step | Evidence | PR |
|---|---|---|---|
| 1 | <step> | <how you will show it works> | planned |
| 2 | <step> | <how you will show it works> | planned |
```

## 5. Save the story in a draft PR now

Why: until the first PR exists, the confirmed intent lives only in the chat. A new session or a compaction can lose or reword it, and the Drift section then compares against the wrong text.

Right after the user confirms the intent and steps, before any code:

1. Create the branch for step 1 from the default branch.
2. `git commit --allow-empty -m "<step 1 title>"`, then push the branch.
3. Write the body to a file in the scratchpad: `## Intent` (the confirmed intent), `## Evidence` ("Pending: <planned evidence for step 1>"), then the `## Story` section.
4. `gh pr create --draft --base <default branch> --title "<step 1 title>" --body-file <path>`.

Ask before you push if the user has not yet allowed pushes in this session. Do the code of step 1 on this branch; pr-write replaces the body when the step is done.

## 6. Branches

One branch per step. Base each branch on the previous step's branch (stacked). The first PR targets the default branch. Open later steps' PRs only when their code is ready.

## During the work

- Keep the real run output of each step in the scratchpad. pr-write needs it, and "tests pass" does not replace it: the same agent wrote the code and the tests.
- When the result drifts from the intent (scope added, removed or changed), tell the user at once and note it for the Drift section. Silent drift is the worst outcome.
- In a new session, find the story in the first PR of the stack: follow `gh pr view <n> --json baseRefName,body` down the bases until the base is the default branch.
