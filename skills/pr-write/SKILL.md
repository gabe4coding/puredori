---
name: pr-write
description: Use when writing or updating a PR body — before `gh pr create` or `gh pr edit --body`, or when the user says "open a PR", "create the PR", "write the PR description", "update the PR body". Writes a two-layer body (intent, drift, decisions, evidence, reading map, stack) sized to the diff.
---

# pr-write

Why: a noisy description is the first reason the user stops reading an AI PR. The person who wrote the prompt owns the result, so the body must give them enough to own it, and nothing more.

## Gather

- `git diff --stat <base>...HEAD` and `git diff --name-status <base>...HEAD`.
- The intent: from pr-plan in this session, or from the Story in the first PR of the stack (`gh pr view <n> --json body`). If there is none, ask the user for it in one sentence.
- Real run output from the work. If there is none, produce it now: run the app, curl the endpoint, take the screenshot, measure. Test output does not count: you wrote the tests. If you cannot, say so in Evidence.

## Size

Check the diff for these signals. They decide the size, and a full body lists the hits in its reading map.

- **Tests changed or deleted:** test files with status D or M; removed or weakened assertions.
- **Config:** env, yaml, json, build files, CI, feature flags, infra.
- **Migrations / schema:** database migrations, schema files.
- **Public API:** routes, controllers, OpenAPI / proto / GraphQL schemas, exported functions and types, events and messages.
- **Error handling:** diff lines that add or remove catch, throw, except, error returns, retries, timeouts.

Small: one concern, about 100 changed lines or less, and no signal hits. Write only these, plus the Stack part below:

```markdown
## Intent

<what was asked, one line the prompter can confirm>

<diagram, see Style>

## Evidence

<real run output: before and after>
```

Otherwise, read `references/full-body.md` in this skill's base directory and use its template.

## Stack

In a stack, end the body with `Step <k>/<n> of <first PR>. Previous: <PR or "none">. Next: <step or "none">.`

The first PR keeps its `## Story` section last, after the Step line. Read it from the PR, not from memory. When step 1 is ready, `gh pr ready <n>`.

### Keep the Story current

Why: reviewers move through the stack from the Story table. A stale row hides an open PR or sends them to a closed one.

After you open or update a PR of a later step, read the first PR (`gh pr view <first PR> --json state,body`). If it is not `OPEN`, leave it: nobody reviews from a closed PR. In the PR column, set this step's row to `#<n> (open)`, and check each other row's PR with `gh pr view <n> --json state`: `(open)`, `(merged)` or `(closed)`. Write the fetched body with only those rows changed to a file, then `gh pr edit <first PR> --body-file <path>`. Do not rebuild the body from memory: you would drop edits made by others.

## Style

- No preamble, no "This PR…", no generic bullets, no list of changed files.
- Use the repo's domain words (`GLOSSARY.md` if present).
- Delete every sentence the reviewer would skip.
- Write in ASD-STE100: one topic per sentence, at most 25 words, active voice, simple present, no "should", "may" or "could".
- Under the Intent text, add a Mermaid diagram in a fenced block: the parts of the system the change touches and how they connect. Mark the changed parts. The reviewer sees the system with the change before the diff.
- Keep the text outside code blocks at 1000 words or less: put run output in code blocks.

Write the body to a file in the scratchpad and pass `--body-file`.
