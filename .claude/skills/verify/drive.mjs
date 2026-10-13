#!/usr/bin/env node
// Drives this plugin in real headless Claude Code, for /verify. One run is one
// session in a new git repo (a `main` branch, a feature branch with one
// commit, and a local bare `origin`), with fake-gh.mjs first on PATH as `gh`.
// Each prompt goes in after the result of the one before. Only this repo's
// copy of the plugin loads: the user's settings and plugins stay out.
// `run` prints the evidence as JSON and keeps the run folder (its path is
// `dir`). Usage: USAGE below.

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const PLUGIN = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/plugin.json'), 'utf8')).name
const PREFIX = `${PLUGIN}-verify-`
const USAGE = `usage:
  node drive.mjs run "<prompt>" ["<prompt>" ...] [--model haiku] [--base <dir>]
                     [--budget 0.5] [--state <gh-state.json>]
  node drive.mjs run --prompts <file.json> [options]
  node drive.mjs clean <dir>

  --prompts reads a JSON array of prompts (see SKILL.md).`
// What the session may do without a person: the file tools, skills, git and
// gh (the fake one). Any other tool or command is denied, and the denial is
// part of the evidence. No interpreter: it could reach the real gh.
const ALLOW = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'Bash(git *)', 'Bash(gh *)', 'Bash(cat *)', 'Bash(ls *)']
// The commits of the setup and of the session, also on a machine without a
// git identity.
const GIT_ID = { GIT_AUTHOR_NAME: 'Verify', GIT_AUTHOR_EMAIL: 'verify@example.com', GIT_COMMITTER_NAME: 'Verify', GIT_COMMITTER_EMAIL: 'verify@example.com' }

const die = msg => {
  console.error(msg)
  process.exit(2)
}
let parsed
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      model: { type: 'string', default: 'haiku' },
      base: { type: 'string', default: os.tmpdir() },
      budget: { type: 'string', default: '0.5' },
      state: { type: 'string' },
      prompts: { type: 'string' },
    },
  })
} catch (err) {
  die(`${err.message}\n${USAGE}`)
}
const { values: flags, positionals: [cmd, ...args] } = parsed
const prompts = flags.prompts ? JSON.parse(fs.readFileSync(flags.prompts, 'utf8')) : args
if (cmd === 'run' && !(Array.isArray(prompts) && prompts.length > 0 && prompts.every(p => typeof p === 'string'))) {
  die(`run needs at least one prompt (--prompts: a JSON array of strings)\n${USAGE}`)
}
const cut = (text, n = 800) => (text.length > n ? `${text.slice(0, n)}… (${text.length} chars)` : text)
// A file of the run folder, parsed, or `empty` when the run did not write it.
const readRun = (dir, name, parse, empty) => {
  const file = path.join(dir, name)
  return fs.existsSync(file) ? parse(fs.readFileSync(file, 'utf8')) : empty
}

// A repo with something to open a PR for: `add-farewell` is one commit ahead
// of `main`, and both are on `origin`. Each of `branches` (the open PRs of
// --state) is on `origin` too, at `main`.
function makeRepo(dir, branches) {
  const cwd = path.join(dir, 'cwd')
  const origin = path.join(dir, 'origin.git')
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, ...GIT_ID } })
  fs.mkdirSync(cwd)
  git('init', '--bare', '-q', '-b', 'main', origin)
  git('init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(cwd, 'greet.js'), "export const greet = name => `Hello, ${name}`\n")
  git('add', '.')
  git('commit', '-q', '-m', 'Add greet')
  git('remote', 'add', 'origin', origin)
  git('switch', '-q', '-c', 'add-farewell')
  fs.appendFileSync(path.join(cwd, 'greet.js'), "export const farewell = name => `Goodbye, ${name}`\n")
  git('commit', '-q', '-am', 'Add farewell')
  git('push', '-q', '-u', 'origin', 'main', 'add-farewell', ...branches.map(b => `main:refs/heads/${b}`))
  if (branches.length) git('fetch', '-q', 'origin')
  return cwd
}

function fakeGh(dir) {
  const bin = path.join(dir, 'bin')
  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\nexec node ${JSON.stringify(path.join(HERE, 'fake-gh.mjs'))} "$@"\n`, { mode: 0o755 })
  return bin
}

async function runSession(dir, cwd, env) {
  const file = name => path.join(dir, name)
  const argv = [
    '-p',
    '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-hook-events',
    '--setting-sources', 'project,local', '--strict-mcp-config',
    '--plugin-dir', ROOT,
    '--allowedTools', ALLOW.join(','),
    // A question needs a person: the session asks in its reply instead.
    '--disallowedTools', 'AskUserQuestion',
    '--permission-prompts', 'none',
    '--debug-file', file('debug.log'),
    '--no-session-persistence', '--max-budget-usd', flags.budget,
    '--model', flags.model,
  ]
  const stream = []
  const out = fs.createWriteStream(file('out.jsonl'))
  const exit = await new Promise(resolve => {
    const child = spawn('claude', argv, { cwd, env })
    child.stderr.pipe(fs.createWriteStream(file('stderr.txt')))
    // A child that did not start fails the stdin write too: 'error' below
    // gives the reason.
    child.stdin.on('error', () => {})
    const timer = setTimeout(() => child.kill(), 600_000)
    let results = 0
    const ask = text => child.stdin.write(`${JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } })}\n`)
    readline.createInterface({ input: child.stdout }).on('line', line => {
      out.write(`${line}\n`)
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        return
      }
      stream.push(msg)
      if (msg.type !== 'result') return
      if (++results < prompts.length) ask(prompts[results])
      else child.stdin.end()
    })
    child.on('error', err => resolve(err.message))
    child.on('close', code => {
      clearTimeout(timer)
      out.end()
      resolve(code)
    })
    ask(prompts[0])
  })
  return { exit, stream }
}

// What the run shows at its surfaces: the reply of each prompt, the rules that
// the SessionStart hook sent, the skills Claude loaded, its tool calls and
// results, the PR gate's denials, what reached gh, and the engine's lines
// about the plugin.
function evidence(dir, { exit, stream }) {
  const blocks = stream.flatMap(m => (Array.isArray(m.message?.content) ? m.message.content : []))
  const text = c => (typeof c === 'string' ? c : (c ?? []).map(x => x.text ?? '').join('\n'))
  const toolUses = blocks.filter(b => b.type === 'tool_use')
  const toolResults = blocks.filter(b => b.type === 'tool_result').map(b => ({ isError: b.is_error === true, content: text(b.content) }))
  const rules = fs.readFileSync(path.join(ROOT, 'hooks/rules.md'), 'utf8')
  // The plugin's lines in the debug log. Each line once, without its time
  // stamp. Not the lines about the installed copy's cache.
  const isPluginLine = l => l.includes(`${PLUGIN}@inline`) || (l.includes(`${PLUGIN}: `) && !l.includes('/plugins/cache/'))
  const pluginLog = log => [...new Set(log.split('\n').filter(isPluginLine).map(l => l.replace(/^\S+ /, '')))]
  return {
    dir,
    exit,
    turns: stream.filter(m => m.type === 'result').map((r, i) => ({ prompt: prompts[i], isError: r.is_error, result: cut(String(r.result ?? '')), totalCostUsd: r.total_cost_usd })),
    // The event does not name the plugin, and the user's managed settings can
    // add SessionStart hooks of their own: match the output to hooks/rules.md.
    rulesSent: stream.some(m => m.type === 'system' && m.subtype === 'hook_response' && m.hook_event === 'SessionStart' && String(m.output).trim() === rules.trim()),
    skills: toolUses.filter(b => b.name === 'Skill').map(b => b.input.skill),
    // A written file or a PR body is in `prs` and `gh`: cut it here.
    toolUses: toolUses.map(b => ({ name: b.name, input: cut(b.name === 'Bash' ? b.input.command : JSON.stringify(b.input)) })),
    toolResults: toolResults.map(r => ({ ...r, content: cut(r.content) })),
    // The engine wraps a denial in its own words: match the plugin prefix.
    gateDenials: toolResults.filter(r => r.isError && r.content.includes(`${PLUGIN}: `)).map(r => r.content),
    gh: readRun(dir, 'calls.jsonl', s => s.split('\n').filter(Boolean).map(l => JSON.parse(l)), []),
    prs: readRun(dir, 'gh-state.json', s => JSON.parse(s).prs, []),
    // A skipped or bypassed hook, a module that did not load.
    pluginLog: readRun(dir, 'debug.log', pluginLog, []),
  }
}

if (cmd === 'run') {
  const dir = fs.mkdtempSync(path.join(flags.base, PREFIX))
  // A start state for gh, for example PRs that a stack already has. The
  // branches of its open PRs must exist, or Claude stops to ask about them.
  const seeded = flags.state ? JSON.parse(fs.readFileSync(flags.state, 'utf8')).prs : []
  const branches = new Set(seeded.filter(p => p.state === 'OPEN').flatMap(p => [p.head, p.base]))
  const cwd = makeRepo(dir, [...branches].filter(b => b !== 'main' && b !== 'add-farewell'))
  if (flags.state) fs.copyFileSync(flags.state, path.join(dir, 'gh-state.json'))
  const env = { ...process.env, ...GIT_ID, PATH: `${fakeGh(dir)}${path.delimiter}${process.env.PATH}`, FAKE_GH_DIR: dir, GH_PROMPT_DISABLED: '1' }
  console.log(JSON.stringify(evidence(dir, await runSession(dir, cwd, env)), null, 2))
} else if (cmd === 'clean') {
  const dir = args[0] ?? die('clean needs the run folder')
  if (!path.basename(dir).startsWith(PREFIX)) die(`not a run folder: ${dir}`)
  fs.rmSync(dir, { recursive: true, force: true })
  console.log(`removed ${dir}`)
} else {
  die(USAGE)
}
