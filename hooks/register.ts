import type { Register } from 'claude-code'
import { bodySources, hasShellVariable, MAX_WORDS, missingSections, proseWords } from './gate.ts'

// The fix for a body file that the hook cannot read. Most often the same
// command writes the file (a redirect, a heredoc, `tee`) or runs `cd` first.
export const VARIABLE_FIX =
  'the path uses a shell variable; write the literal path. If this command also writes the file, write it in a separate step (Write tool) first.'
export const SEPARATE_STEP_FIX =
  'the hook reads it before the command runs, from the session directory. Write the body file in a separate step (Write tool), then run gh with its absolute path.'

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
          const fix = hasShellVariable(source.path) ? VARIABLE_FIX : SEPARATE_STEP_FIX
          return { deny: `${$.plugin.name}: cannot read the PR body file ${source.path}: ${fix}` }
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

      const words = proseWords(body)
      if (words > MAX_WORDS) {
        return {
          deny:
            `${$.plugin.name}: the PR body has ${words} words outside code blocks (max ${MAX_WORDS}). ` +
            `Load skill ${$.plugin.name}:pr-write, delete the sentences the reviewer would skip, and run the command again with --body-file.`,
        }
      }
    }
    return next(e)
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: the PR gate failed; check the body by hand with skill ${$.plugin.name}:pr-write.` },
  )
}
