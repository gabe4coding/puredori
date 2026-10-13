// What the PR gate reads from a Bash command: the `gh pr create` and
// `gh pr edit` commands it runs, where each one's PR body is, and which
// required sections a body lacks. The same words in a quoted string, a heredoc
// or a commit message do not count.
//
// The gate is a nudge for an agent that follows the rules, not a security
// boundary: `bash -c '...'`, `eval` or an alias get past it. Do not add lexer
// cases for those.

export const REQUIRED = ['Intent', 'Evidence'] as const
const SECTIONS = REQUIRED.map(name => ({ name, pattern: new RegExp(`^#{2,3}\\s*${name}\\b`, 'mi') }))

export type BodySource = { kind: 'inline'; body: string } | { kind: 'file'; path: string }

// One simple command: its words without quotes (a `$(...)` stays as written),
// and the heredoc bodies that feed its stdin.
type Segment = { words: string[]; stdin: string[] }
type Heredoc = { delim: string; strip: boolean }

const OPERATORS = ';&|()'
const isSpace = (c: string | undefined) => c === ' ' || c === '\t'

// The text between the quote at `i` and its closing quote (or the end), and
// the index after it.
const readQuoted = (src: string, i: number) => {
  const close = src.indexOf(src[i], i + 1)
  const end = close === -1 ? src.length : close
  return { text: src.slice(i + 1, end), next: end + 1 }
}

// Reads the heredoc bodies that start at `i` (the char after a newline), in
// order. Returns the bodies and the index after the last delimiter line.
const readHeredocs = (src: string, i: number, pending: Heredoc[]) => {
  const bodies: string[] = []
  for (const { delim, strip } of pending) {
    const lines: string[] = []
    while (i < src.length) {
      let end = src.indexOf('\n', i)
      if (end === -1) end = src.length
      const line = src.slice(i, end)
      i = end + 1
      if ((strip ? line.replace(/^\t+/, '') : line) === delim) break
      lines.push(line)
    }
    bodies.push(lines.join('\n'))
  }
  return { bodies, next: Math.min(i, src.length) }
}

// A shell lexer, as far as the gate needs one. It splits `src` from `start`
// into simple commands at unquoted `;`, `&`, `&&`, `|`, `||`, `(`, `)` and
// newlines. The commands inside a `$(...)` are in the result too. Inside a
// `$(...)` (`nested`) it stops at the `)` that closes it and returns its index.
const lex = (src: string, start: number, nested: boolean): { segments: Segment[]; end: number } => {
  const segments: Segment[] = []
  let seg: Segment = { words: [], stdin: [] }
  let word: string | undefined
  let pending: Heredoc[] = []
  const add = (text: string) => {
    word = (word ?? '') + text
  }
  const endWord = () => {
    if (word !== undefined) seg.words.push(word)
    word = undefined
  }
  const endSegment = () => {
    endWord()
    if (seg.words.length > 0) segments.push(seg)
    seg = { words: [], stdin: [] }
  }
  // Reads a `$(...)` that starts at `i`: its text as written, and its commands.
  const substitution = (i: number) => {
    const inner = lex(src, i + 2, true)
    segments.push(...inner.segments)
    return src.slice(i, inner.end + 1)
  }

  let i = start
  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]
    if (c === '\n') {
      endWord()
      if (pending.length > 0) {
        const heredocs = readHeredocs(src, i + 1, pending)
        seg.stdin.push(...heredocs.bodies)
        pending = []
        i = heredocs.next
      } else i++
      endSegment()
    } else if (isSpace(c)) {
      endWord()
      i++
    } else if (c === '\\') {
      // A backslash before a newline joins the lines.
      if (next !== '\n') add(next ?? '')
      i += 2
    } else if (c === "'") {
      const quoted = readQuoted(src, i)
      add(quoted.text)
      i = quoted.next
    } else if (c === '`') {
      const quoted = readQuoted(src, i)
      add(`\`${quoted.text}\``)
      i = quoted.next
    } else if (c === '"') {
      i++
      add('')
      while (i < src.length && src[i] !== '"') {
        // In double quotes a backslash escapes only $ ` " \ and a newline.
        if (src[i] === '\\' && '$`"\\\n'.includes(src[i + 1] ?? 'x')) {
          if (src[i + 1] !== '\n') add(src[i + 1])
          i += 2
        } else if (src[i] === '$' && src[i + 1] === '(') {
          const sub = substitution(i)
          add(sub)
          i += sub.length
        } else add(src[i++])
      }
      i++
    } else if (c === '$' && next === '(') {
      const sub = substitution(i)
      add(sub)
      i += sub.length
    } else if (c === '<' && next === '<' && src[i + 2] === '<') {
      // A here-string: its text is the next word.
      endWord()
      i += 3
    } else if (c === '<' && next === '<') {
      // A heredoc: its body starts after the next newline.
      endWord()
      i += 2
      const strip = src[i] === '-'
      if (strip) i++
      while (isSpace(src[i])) i++
      let delim = ''
      while (i < src.length && !isSpace(src[i]) && !`${OPERATORS}<>\n`.includes(src[i])) {
        if (src[i] === "'" || src[i] === '"') {
          const quoted = readQuoted(src, i)
          delim += quoted.text
          i = quoted.next
        } else delim += src[i++]
      }
      pending.push({ delim, strip })
    } else if (c === '&' && (next === '>' || word?.endsWith('>'))) {
      // `2>&1` and `&>file` are redirects, not a background `&`.
      add(c)
      i++
    } else if (c === ')' && nested) {
      endSegment()
      return { segments, end: i }
    } else if (OPERATORS.includes(c)) {
      endSegment()
      i += (c === '&' || c === '|') && next === c ? 2 : 1
    } else {
      add(c)
      i++
    }
  }
  endSegment()
  return { segments, end: src.length }
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const GH = /(?:^|\/)gh$/

// The value of a flag in `args`: `--name value`, `--name=value`, `-x value`
// or `-xvalue`. `names` holds the long name, then the short one.
const flagValue = (args: string[], [long, short]: [string, string]) => {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === long || arg === short) return args[i + 1] ?? ''
    if (arg.startsWith(`${long}=`)) return arg.slice(long.length + 1)
    if (!arg.startsWith('--') && arg.startsWith(short)) return arg.slice(short.length)
  }
  return undefined
}

const bodySource = ({ words, stdin }: Segment): BodySource[] => {
  const [gh, group, cmd, ...args] = words.slice(words.findIndex(w => !ASSIGNMENT.test(w)))
  if (!GH.test(gh ?? '') || group !== 'pr' || (cmd !== 'create' && cmd !== 'edit')) return []
  // --web hands the body to the person in the browser.
  if (args.includes('--web') || args.includes('-w')) return []
  const file = flagValue(args, ['--body-file', '-F'])
  const body = flagValue(args, ['--body', '-b'])
  if (file === '-') return [{ kind: 'inline', body: stdin.join('\n') }]
  if (file !== undefined) return [{ kind: 'file', path: file }]
  if (body !== undefined) return [{ kind: 'inline', body }]
  // Without a body flag, gh pr create writes an empty body (--fill too).
  return cmd === 'create' ? [{ kind: 'inline', body: '' }] : []
}

// The PR bodies that a command writes, one for each `gh pr create` and each
// `gh pr edit` with a body flag. Empty: the command writes no PR body, so the
// gate lets it run. Most commands have no `gh` at all: they skip the lexer.
export const bodySources = (command: string): BodySource[] =>
  command.includes('gh') ? lex(command, 0, false).segments.flatMap(bodySource) : []

export const missingSections = (body: string): string[] =>
  SECTIONS.filter(({ pattern }) => !pattern.test(body)).map(({ name }) => name)
