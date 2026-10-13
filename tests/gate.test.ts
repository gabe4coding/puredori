import { test, expect } from 'claude-code/testing'
import { bodySource, missingSections } from '../hooks/gate.ts'

const GOOD = `gh pr create --title "x" --body "$(cat <<'EOF'
## Intent
Add retry to the payment client.

## Evidence
curl output before and after
EOF
)"`

test('bodySource reads where the body is', async () => {
  expect(bodySource('git status').kind).toBe('none')
  expect(bodySource('gh pr view 12').kind).toBe('none')
  expect(bodySource('gh pr edit 12 --add-label bug').kind).toBe('none')
  expect(bodySource('gh pr create --web').kind).toBe('none')
  expect(bodySource('gh pr create --fill').kind).toBe('inline')
  expect(bodySource('gh pr edit 12 --body "x"').kind).toBe('inline')
  expect(bodySource('gh pr create -F - <<EOF').kind).toBe('inline')
  expect(bodySource('gh pr create --body-file /tmp/b.md')).toEqual({ kind: 'file', path: '/tmp/b.md' })
  expect(bodySource(`gh pr create -F '/tmp/a b.md'`)).toEqual({ kind: 'file', path: '/tmp/a b.md' })
})

test('missingSections names what the body lacks', async () => {
  expect(missingSections('## Intent\nx\n## Evidence\ny')).toEqual([])
  expect(missingSections('### intent\nx')).toEqual(['Evidence'])
  expect(missingSections('Intent and Evidence in prose')).toEqual(['Intent', 'Evidence'])
})

test('the gate blocks a PR body without the required sections', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ran' }) as never)

  const bad = await $.tool.call({ tool: 'Bash', command: 'gh pr create --title x --body "fixes stuff"' })
  expect(bad.deny).toContain("## Intent")
  expect(bad.deny).toContain("pr-shape:pr-write")

  const good = await $.tool.call({ tool: 'Bash', command: GOOD })
  expect(good.deny).toBeUndefined()

  const other = await $.tool.call({ tool: 'Bash', command: 'git log -1' })
  expect(other.deny).toBeUndefined()
})
