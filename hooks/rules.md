# PR shape (pr-shape plugin)

The user reviews AI PRs by intent, drift and real evidence, and samples the diff by mechanical signals. Their attention is the budget, so the shape of the diff matters as much as the PR text.

- Before code work that will end in a PR, load skill `pr-shape:pr-plan`: confirm the intent and split the work into a stack of small PRs. Skip it for a one-line fix.
- One intent per branch. If you cannot show a change works with real run output, make the step smaller.
- Keep mechanical changes (rename, move, format, generated code, dependency bump) in their own commit or PR, apart from logic.
- While you work, keep real run output (curl, log, screenshot, numbers before and after) for the PR. "Tests pass" is not evidence: you wrote the tests.
- When the result drifts from the confirmed intent (scope added, removed or changed), tell the user when it happens and keep a note for the PR.
- A standards violation you notice is an enforcement gap: propose a lint, type or arch rule (skill `harden-codebase`) instead of a review comment.
- Before `gh pr create` or `gh pr edit --body`, load skill `pr-shape:pr-write`. A hook blocks a PR body without `## Intent` and `## Evidence`.
