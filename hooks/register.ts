import type { Register } from 'claude-code'
import { bodySource, missingSections } from './gate.ts'

const RULES = `# PR shape (pr-shape plugin)

The user reviews AI PRs by intent, drift and real evidence, and samples the diff by mechanical signals. Their attention is the budget, so the shape of the diff matters as much as the PR text.

- Before code work that will end in a PR, load skill \`pr-shape:pr-plan\`: confirm the intent and split the work into a stack of small PRs. Skip it for a one-line fix.
- One intent per branch. If you cannot show a change works with real run output, make the step smaller.
- Keep mechanical changes (rename, move, format, generated code, dependency bump) in their own commit or PR, apart from logic.
- While you work, keep real run output (curl, log, screenshot, numbers before and after) for the PR. "Tests pass" is not evidence: you wrote the tests.
- When the result drifts from the confirmed intent (scope added, removed or changed), tell the user when it happens and keep a note for the PR.
- A standards violation you notice is an enforcement gap: propose a lint, type or arch rule (skill \`harden-codebase\`) instead of a review comment.
- Before \`gh pr create\` or \`gh pr edit --body\`, load skill \`pr-shape:pr-write\`. A hook blocks a PR body without \`## Intent\` and \`## Evidence\`.`

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    return {
      sections: [
        ...sections,
        { id: `${$.plugin.name}:rules`, text: RULES, scope: 'session' as const },
      ],
    }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const source = bodySource(e.command)
    if (source.kind === 'none') return next(e)

    const path = source.kind === 'file' ? source.path : undefined
    const body = path === undefined ? e.command : await $.fs.read(path).catch(() => undefined)
    if (body === undefined) {
      return {
        deny: `${$.plugin.name}: cannot read the PR body file ${path}. Write it first, then run the command again.`,
      }
    }

    const missing = missingSections(body)
    if (missing.length === 0) return next(e)
    return {
      deny:
        `${$.plugin.name}: the PR body has no ${missing.map(s => `"## ${s}"`).join(' or ')} section. ` +
        'Load skill pr-shape:pr-write, write the body to a file with its template, and run the command again with --body-file.',
    }
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: the PR gate failed; check the body by hand with skill pr-shape:pr-write.` },
  )
}
