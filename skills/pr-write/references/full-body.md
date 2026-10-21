# Full PR body

For a PR that is not small.

```markdown
## Intent

<what was asked, 1–2 sentences the prompter can confirm>

<Mermaid diagram of the system with the change, see the skill's Style>

## Drift

<where the result differs from the intent: scope added, removed or changed. "None." if none>

## Decisions

- <only choices that change what to do next or make the next step less predictable>
- Door: <one-way | two-way> — <one line: can this be rolled back cheaply?>

## Evidence

**Before:** <real run output: screenshot, curl, log, numbers>
**After:** <the same, after the change>

## Reading map

<signal hits, rules below>

## Stack

<see the skill>
```

## Reading map

Why: the user samples the code here. If you choose where they look, the sample is worthless. Build the map from the signals in the skill, not from your idea of risk, and add no "risky areas" list of your own.

Under each signal with hits, list the paths (with line ranges when useful). Leave out a signal with no hits.
