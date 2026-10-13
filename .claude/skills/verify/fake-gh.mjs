#!/usr/bin/env node
// A fake `gh` for /verify: drive.mjs puts it first on PATH as `gh`, so a run
// never reaches GitHub. It keeps the PRs in gh-state.json and logs each call
// (argv, and the PR body it read) to calls.jsonl, both in the run folder
// (FAKE_GH_DIR). It knows the commands that the skills use: `pr create`,
// `pr edit`, `pr view`, `pr list`, `pr ready` and `repo view`. Anything else
// fails with exit 1.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DIR = process.env.FAKE_GH_DIR
const STATE = path.join(DIR, 'gh-state.json')
const REPO = 'https://github.com/example/demo'

const argv = process.argv.slice(2)
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { prs: [] }
const log = extra => fs.appendFileSync(path.join(DIR, 'calls.jsonl'), `${JSON.stringify({ argv, ...extra })}\n`)
const fail = msg => {
  log({ error: msg })
  console.error(`gh: ${msg}`)
  process.exit(1)
}

// Flags: `--name value`, `--name=value`, `-x value`, and boolean flags.
const BOOLEAN = new Set(['--draft', '-d', '--web', '-w', '--fill', '-f'])
const flags = {}
const positional = []
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  if (!arg.startsWith('-')) positional.push(arg)
  else if (arg.includes('=')) flags[arg.slice(0, arg.indexOf('='))] = arg.slice(arg.indexOf('=') + 1)
  else if (BOOLEAN.has(arg)) flags[arg] = true
  else flags[arg] = argv[++i]
}
const flag = (...names) => names.map(n => flags[n]).find(v => v !== undefined)

const branch = () => execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
const url = pr => `${REPO}/pull/${pr.number}`
// A PR by head branch, number or URL. Without one, the PR of the current
// branch. A branch wins: `feature/2` is a branch, not PR 2.
const find = ref => {
  const key = ref ?? branch()
  const number = Number(key.replace(/^https:\/\/.*\/pull\//, ''))
  return state.prs.find(p => p.head === key) ?? state.prs.find(p => p.number === number) ?? fail(`no pull requests found for ${key}`)
}
const readBody = () => {
  const file = flag('--body-file', '-F')
  if (file === '-') return fs.readFileSync(0, 'utf8')
  if (file !== undefined) return fs.readFileSync(file, 'utf8')
  return flag('--body', '-b')
}
// The fields of `gh pr view --json` that the skills read.
const view = pr => ({
  number: pr.number,
  url: url(pr),
  title: pr.title,
  body: pr.body,
  state: pr.state,
  isDraft: pr.draft,
  baseRefName: pr.base,
  headRefName: pr.head,
})
const pick = (obj, fields) => (fields ? Object.fromEntries(fields.split(',').map(f => [f, obj[f]])) : obj)
const print = (value, text) => console.log(flag('--json') ? JSON.stringify(Array.isArray(value) ? value.map(v => pick(v, flag('--json'))) : pick(value, flag('--json'))) : text)

const [group, cmd, ref] = positional
const command = `${group} ${cmd}`
let body
if (command === 'repo view') {
  print({ name: 'demo', url: REPO, defaultBranchRef: { name: 'main' } }, REPO)
} else if (command === 'pr create') {
  body = readBody()
  const pr = {
    number: state.prs.length + 1,
    // --fill takes the title from the last commit, as the real gh does.
    title: flag('--title', '-t') ?? (flag('--fill', '-f') ? execFileSync('git', ['log', '-1', '--format=%s'], { encoding: 'utf8' }).trim() : ''),
    body: body ?? '',
    base: flag('--base', '-B') ?? 'main',
    head: flag('--head', '-H') ?? branch(),
    draft: flag('--draft', '-d') === true,
    state: 'OPEN',
  }
  state.prs.push(pr)
  console.log(url(pr))
} else if (command === 'pr edit') {
  const pr = find(ref)
  body = readBody()
  const changes = { body, title: flag('--title', '-t'), base: flag('--base', '-B') }
  for (const [key, value] of Object.entries(changes)) if (value !== undefined) pr[key] = value
  console.log(url(pr))
} else if (command === 'pr view') {
  const pr = find(ref)
  print(view(pr), `${pr.title}\n${url(pr)}\n\n${pr.body}`)
} else if (command === 'pr list') {
  const head = flag('--head', '-H')
  const prs = state.prs.filter(p => head === undefined || p.head === head).map(view)
  print(prs, prs.map(p => `${p.number}\t${p.title}\t${p.headRefName}\t${p.state}`).join('\n'))
} else if (command === 'pr ready') {
  const pr = find(ref)
  pr.draft = false
  console.log(`✓ Pull request #${pr.number} is marked as "ready for review"`)
} else {
  fail(`fake gh does not support: ${argv.join(' ')}`)
}
fs.writeFileSync(STATE, JSON.stringify(state, null, 2))
log({ body })
