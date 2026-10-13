import type { Register } from 'claude-code'
import { bodySources, missingSections } from './gate.ts'

// The rules are hooks/rules.md, sent by a SessionStart command hook in hooks.json:
// Claude Code's built-in security module bypasses the prompt.compose and
// prompt.section handlers of a plugin module (debug log: "prompt.section
// bypassed by cc-plugin-sec-default").
export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    for (const source of bodySources(e.command)) {
      let body = source.kind === 'inline' ? source.body : undefined
      if (source.kind === 'file') {
        body = await $.fs.read(source.path).catch(() => undefined)
        if (body === undefined) {
          return {
            deny: `${$.plugin.name}: cannot read the PR body file ${source.path}. Write it first, then run the command again.`,
          }
        }
      }

      const missing = missingSections(body)
      if (missing.length > 0) {
        return {
          deny:
            `${$.plugin.name}: the PR body has no ${missing.map(s => `"## ${s}"`).join(' or ')} section. ` +
            `Load skill ${$.plugin.name}:pr-write, write the body to a file with its template, and run the command again with --body-file.`,
        }
      }
    }
    return next(e)
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: the PR gate failed; check the body by hand with skill ${$.plugin.name}:pr-write.` },
  )
}
