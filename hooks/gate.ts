// What the PR gate reads from a Bash command: whether it writes a PR body,
// where that body is, and which required sections it lacks.

const PR_CREATE = /\bgh\s+pr\s+create\b/
const PR_EDIT = /\bgh\s+pr\s+edit\b/
const BODY_FLAG = /(?:^|\s)(?:--body|-b|--body-file|-F)(?:[\s=]|$)/
const BODY_FILE = /(?:^|\s)(?:--body-file|-F)[\s=]+(?:"([^"]+)"|'([^']+)'|(\S+))/
const WEB = /(?:^|\s)(?:--web|-w)(?:\s|$)/

export const REQUIRED = ['Intent', 'Evidence'] as const

export type BodySource =
  | { kind: 'none' }
  | { kind: 'inline' }
  | { kind: 'file'; path: string }

// `none`: the command writes no PR body, so the gate lets it run.
// `inline`: the body is in the command text (--body, a heredoc, `-F -`).
// `file`: the body is in a file the command names.
export const bodySource = (command: string): BodySource => {
  const isCreate = PR_CREATE.test(command)
  const isEdit = PR_EDIT.test(command)
  if (!isCreate && !isEdit) return { kind: 'none' }
  // --web hands the body to the person in the browser.
  if (WEB.test(command)) return { kind: 'none' }
  // gh pr edit without a body flag changes labels, title, reviewers.
  if (isEdit && !BODY_FLAG.test(command)) return { kind: 'none' }

  const file = BODY_FILE.exec(command)
  const path = file?.[1] ?? file?.[2] ?? file?.[3]
  if (path !== undefined && path !== '-') return { kind: 'file', path }
  return { kind: 'inline' }
}

export const missingSections = (body: string): string[] =>
  REQUIRED.filter(name => !new RegExp(`^#{2,3}\\s*${name}\\b`, 'mi').test(body))
