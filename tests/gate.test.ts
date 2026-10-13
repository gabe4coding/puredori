import { test, expect } from 'claude-code/testing'
import { bodySources, missingSections } from '../hooks/gate.ts'

const BODY = '## Intent\nAdd retry to the payment client.\n\n## Evidence\ncurl output before and after'

const GOOD = `gh pr create --title "x" --body "$(cat <<'EOF'
${BODY}
EOF
)"`

test('bodySources finds the PR bodies that a command writes', async () => {
  expect(bodySources('gh pr create --fill')).toEqual([{ kind: 'inline', body: '' }])
  expect(bodySources('gh pr edit 12 --body "x"')).toEqual([{ kind: 'inline', body: 'x' }])
  expect(bodySources('gh pr edit 12 --body=x')).toEqual([{ kind: 'inline', body: 'x' }])
  expect(bodySources('gh pr create --body-file /tmp/b.md')).toEqual([{ kind: 'file', path: '/tmp/b.md' }])
  expect(bodySources(`gh pr create -F '/tmp/a b.md'`)).toEqual([{ kind: 'file', path: '/tmp/a b.md' }])
  expect(bodySources(GOOD)).toEqual([{ kind: 'inline', body: `$(cat <<'EOF'\n${BODY}\nEOF\n)` }])
  expect(bodySources(`gh pr create -F - <<'EOF'\n${BODY}\nEOF`)).toEqual([{ kind: 'inline', body: BODY }])
  expect(bodySources('git push -u origin x && GH_DEBUG=1 /opt/homebrew/bin/gh pr create -b y')).toEqual([{ kind: 'inline', body: 'y' }])
  expect(bodySources('url="$(gh pr create --body x)"')).toEqual([{ kind: 'inline', body: 'x' }])
  expect(bodySources('gh \\\n  pr create \\\n  --body x')).toEqual([{ kind: 'inline', body: 'x' }])
  expect(bodySources('gh pr create --body "a\\nb \\"c\\" \\$d"')).toEqual([{ kind: 'inline', body: 'a\\nb "c" $d' }])
  expect(bodySources('grep x <<< "$a"\ngh pr create --body y')).toEqual([{ kind: 'inline', body: 'y' }])
  expect(bodySources('gh pr create -F/tmp/b.md')).toEqual([{ kind: 'file', path: '/tmp/b.md' }])
  expect(bodySources('gh pr edit 3 -bx')).toEqual([{ kind: 'inline', body: 'x' }])
  expect(bodySources('gh pr edit 1 --body a; gh pr edit 2 --body b')).toEqual([
    { kind: 'inline', body: 'a' },
    { kind: 'inline', body: 'b' },
  ])
})

test('bodySources ignores commands that write no PR body', async () => {
  expect(bodySources('git status')).toEqual([])
  expect(bodySources('gh pr view 12')).toEqual([])
  expect(bodySources('gh pr edit 12 --add-label bug')).toEqual([])
  expect(bodySources('gh pr create --web')).toEqual([])
})

test('bodySources ignores text that only names the command', async () => {
  expect(bodySources('grep -rn "gh pr create" skills/')).toEqual([])
  expect(bodySources(`git commit -m "Deny gh pr create without sections"`)).toEqual([])
  expect(bodySources(`node drive.mjs run "Run gh pr create --body 'x'"`)).toEqual([])
  expect(bodySources(`cat > notes.md <<'EOF'\nthen run gh pr create\nEOF`)).toEqual([])
  expect(bodySources('echo gh pr create')).toEqual([])
  expect(bodySources('gh pr edit 12 --add-label bug && grep -F foo file.txt')).toEqual([])
  expect(bodySources('gh pr edit 12 --add-label bug 2>&1 | tail -1')).toEqual([])
})

test('missingSections names what the body lacks', async () => {
  expect(missingSections('## Intent\nx\n## Evidence\ny')).toEqual([])
  expect(missingSections('### intent\nx')).toEqual(['Evidence'])
  expect(missingSections('Intent and Evidence in prose')).toEqual(['Intent', 'Evidence'])
})

test('the gate blocks a PR body without the required sections', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ran' }) as never)

  const bad = await $.tool.call({ tool: 'Bash', command: 'gh pr create --title x --body "fixes stuff"' })
  expect(bad.deny).toContain('## Intent')
  expect(bad.deny).toContain('pr-shape:pr-write')

  // The command text names both sections, but the body has neither.
  const named = await $.tool.call({ tool: 'Bash', command: 'gh pr create --title "## Intent ## Evidence" --body x' })
  expect(named.deny).toContain('## Intent')

  const second = await $.tool.call({ tool: 'Bash', command: `gh pr edit 1 --body "${BODY}"; gh pr edit 2 --body x` })
  expect(second.deny).toContain('## Intent')

  const good = await $.tool.call({ tool: 'Bash', command: GOOD })
  expect(good.deny).toBeUndefined()

  const commit = await $.tool.call({ tool: 'Bash', command: 'git commit -m "Deny gh pr create without sections"' })
  expect(commit.deny).toBeUndefined()

  const other = await $.tool.call({ tool: 'Bash', command: 'git log -1' })
  expect(other.deny).toBeUndefined()
})
