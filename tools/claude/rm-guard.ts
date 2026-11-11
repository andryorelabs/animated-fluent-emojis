import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface Word {
  text: string
  isDynamic: boolean
  hasGlob: boolean
}

interface Segment {
  readonly words: Word[]
  readonly heredocs: string[]
}

interface Frame {
  readonly closer: ')' | '`'
  readonly isSubstitution: boolean
  readonly outerSegment: Segment
  readonly outerWord: Word | undefined
  readonly wasInDoubleQuotes: boolean
}

interface PendingHeredoc {
  readonly delimiter: string
  readonly stripsTabs: boolean
  readonly segment: Segment
}

const SHELL_COMMANDS = new Set(['sh', 'bash', 'zsh', 'dash'])
const REMOVE_COMMANDS = new Set(['rm'])
const WRAPPER_COMMANDS = new Set([
  'sudo',
  'doas',
  'command',
  'builtin',
  'exec',
  'env',
  'nice',
  'nohup',
  'timeout',
  'xargs',
])
const PREFIX_WORDS = new Set([
  '{',
  '!',
  'if',
  'then',
  'else',
  'elif',
  'do',
  'while',
  'until',
  'time',
])
const FIND_EXEC_FLAGS = new Set(['-exec', '-execdir', '-ok', '-okdir'])
const MENTIONS_RM = /(^|[^\w.-])rm($|[^\w.-])/
const GLOB_CHARACTER = /[*?[]/
const HEREDOC_DELIMITER_END = /[\s;|&()<>]/

class UnparsableCommandError extends Error {}

class ShellScanner {
  private readonly segments: Segment[] = []
  private readonly frames: Frame[] = []
  private readonly pendingHeredocs: PendingHeredoc[] = []
  private segment: Segment = { words: [], heredocs: [] }
  private word: Word | undefined
  private isInSingleQuotes = false
  private isInDoubleQuotes = false
  private skipsNextWord = false
  private index = 0
  private readonly command: string

  constructor(command: string) {
    this.command = command
  }

  private consume(character: string): void {
    if (this.isInSingleQuotes) {
      this.consumeSingleQuoted(character)
      return
    }
    switch (character) {
      case '\\': {
        this.consumeEscape()
        break
      }
      case '`': {
        this.toggleBacktick()
        break
      }
      case '$': {
        this.consumeDollar()
        break
      }
      default: {
        if (this.isInDoubleQuotes) this.consumeDoubleQuoted(character)
        else this.consumeUnquoted(character)
      }
    }
  }

  private consumeSingleQuoted(character: string): void {
    if (character === "'") this.isInSingleQuotes = false
    else this.append(character)
  }

  private consumeEscape(): void {
    this.index += 1
    const escaped = this.command.charAt(this.index)
    if (escaped !== '\n') this.append(escaped)
  }

  private toggleBacktick(): void {
    if (this.frames.at(-1)?.closer === '`' && !this.isInDoubleQuotes) {
      this.popFrame()
    } else {
      this.pushFrame('`', true)
    }
  }

  private consumeDollar(): void {
    if (this.command.charAt(this.index + 1) === '(') {
      this.index += 1
      this.pushFrame(')', true)
    } else {
      this.append('$').isDynamic = true
    }
  }

  private consumeDoubleQuoted(character: string): void {
    if (character === '"') this.isInDoubleQuotes = false
    else this.append(character)
  }

  private consumeUnquoted(character: string): void {
    switch (character) {
      case "'": {
        this.isInSingleQuotes = true
        this.append('')
        break
      }
      case '"': {
        this.isInDoubleQuotes = true
        this.append('')
        break
      }
      case '\n': {
        this.endSegment()
        this.consumeHeredocBodies()
        break
      }
      case ';':
      case '|':
      case '&': {
        this.endSegment()
        break
      }
      case '<':
      case '>': {
        this.consumeRedirection(character)
        break
      }
      case '(': {
        this.pushFrame(')', false)
        break
      }
      case ')': {
        this.closeParenthesis()
        break
      }
      default: {
        this.consumeOrdinary(character)
      }
    }
  }

  private consumeOrdinary(character: string): void {
    if (/\s/.test(character)) this.endWord()
    else if (character === '#' && this.word === undefined) this.skipComment()
    else this.appendUnquoted(character)
  }

  private appendUnquoted(character: string): void {
    const isTildePrefix = character === '~' && this.word === undefined
    const word = this.append(character)
    if (isTildePrefix || character === '{' || character === '}') {
      word.isDynamic = true
    }
    if (GLOB_CHARACTER.test(character)) word.hasGlob = true
  }

  private append(text: string): Word {
    this.word ??= { text: '', isDynamic: false, hasGlob: false }
    this.word.text += text
    return this.word
  }

  private endWord(): void {
    if (this.word === undefined) return
    if (this.skipsNextWord) this.skipsNextWord = false
    else this.segment.words.push(this.word)
    this.word = undefined
  }

  private endSegment(): void {
    this.endWord()
    this.skipsNextWord = false
    this.segments.push(this.segment)
    this.segment = { words: [], heredocs: [] }
  }

  private pushFrame(closer: Frame['closer'], isSubstitution: boolean): void {
    if (!isSubstitution) this.endWord()
    this.frames.push({
      closer,
      isSubstitution,
      outerSegment: this.segment,
      outerWord: this.word,
      wasInDoubleQuotes: this.isInDoubleQuotes,
    })
    this.segment = { words: [], heredocs: [] }
    this.word = undefined
    this.isInDoubleQuotes = false
    this.skipsNextWord = false
  }

  private popFrame(): void {
    const frame = this.frames.pop()
    if (frame === undefined) return
    this.endWord()
    this.segments.push(this.segment)
    this.segment = frame.outerSegment
    this.word = frame.outerWord
    this.isInDoubleQuotes = frame.wasInDoubleQuotes
    if (frame.isSubstitution) this.append('').isDynamic = true
  }

  private closeParenthesis(): void {
    if (this.frames.at(-1)?.closer === ')') this.popFrame()
    else this.endSegment()
  }

  private skipComment(): void {
    const lineEnd = this.command.indexOf('\n', this.index)
    this.index = (lineEnd === -1 ? this.command.length : lineEnd) - 1
  }

  private consumeRedirection(character: string): void {
    if (this.word !== undefined && /^\d*$/.test(this.word.text)) {
      this.word = undefined
    }
    this.endWord()
    const rest = this.command.slice(this.index)
    if (character === '<' && /^<<(?!<)/.test(rest)) {
      this.registerHeredoc()
      return
    }
    const operator = /^[<>]+[&|]?/.exec(rest)?.[0] ?? character
    this.index += operator.length - 1
    this.skipsNextWord = true
  }

  private registerHeredoc(): void {
    const header = /^<<(-?)[ \t]*/.exec(this.command.slice(this.index))
    const start = this.index + (header?.[0].length ?? 2)
    let end = start
    while (
      end < this.command.length &&
      !HEREDOC_DELIMITER_END.test(this.command.charAt(end))
    ) {
      end += 1
    }
    const delimiter = this.command.slice(start, end).replaceAll(/['"\\]/g, '')
    if (delimiter === '') throw new UnparsableCommandError()
    this.pendingHeredocs.push({
      delimiter,
      stripsTabs: header?.[1] === '-',
      segment: this.segment,
    })
    this.index = end - 1
  }

  private consumeHeredocBodies(): void {
    for (const heredoc of this.pendingHeredocs.splice(0)) {
      heredoc.segment.heredocs.push(this.readHeredocBody(heredoc))
    }
  }

  private readHeredocBody(heredoc: PendingHeredoc): string {
    const body: string[] = []
    for (;;) {
      if (this.index >= this.command.length - 1) {
        throw new UnparsableCommandError()
      }
      const lineStart = this.index + 1
      const nextBreak = this.command.indexOf('\n', lineStart)
      const lineEnd = nextBreak === -1 ? this.command.length : nextBreak
      const rawLine = this.command.slice(lineStart, lineEnd)
      const line = heredoc.stripsTabs ? rawLine.replace(/^\t+/, '') : rawLine
      this.index = lineEnd
      if (line === heredoc.delimiter) return body.join('\n')
      body.push(line)
    }
  }

  scan(): Segment[] {
    for (; this.index < this.command.length; this.index += 1) {
      this.consume(this.command.charAt(this.index))
    }
    if (
      this.isInSingleQuotes ||
      this.isInDoubleQuotes ||
      this.frames.length > 0 ||
      this.pendingHeredocs.length > 0
    ) {
      throw new UnparsableCommandError()
    }
    this.endSegment()
    return this.segments
  }
}

function commandName(word: Word | undefined): string {
  return word === undefined ? '' : path.basename(word.text)
}

function isPrefixWord(word: Word): boolean {
  return PREFIX_WORDS.has(word.text) || /^\w+=/.test(word.text)
}

/**
 * Index of the word that runs one of `names` in a segment: the command word
 * itself, any later word behind a wrapper such as `sudo` or `xargs`, or the
 * word after a `find -exec` flag. A `git` subcommand never counts.
 * @param words The words of one command segment.
 * @param names The command names to look for.
 * @returns The index of the matching word, or `-1` when none runs.
 */
function findCommandIndex(
  words: readonly Word[],
  names: ReadonlySet<string>,
): number {
  const start = words.findIndex((word) => !isPrefixWord(word))
  const head = commandName(words[start])
  if (names.has(head)) return start
  const isWrapped = WRAPPER_COMMANDS.has(head)
  if (!isWrapped && head !== 'find') return -1
  return words.findIndex((word, index) => {
    if (index <= start || !names.has(commandName(word))) return false
    const previous = words[index - 1]
    return isWrapped
      ? commandName(previous) !== 'git'
      : FIND_EXEC_FLAGS.has(previous?.text ?? '')
  })
}

function findRepositoryRoot(cwd: string): string {
  let directory = path.resolve(cwd)
  for (;;) {
    if (existsSync(path.join(directory, '.git'))) return directory
    const parent = path.dirname(directory)
    if (parent === directory) return path.resolve(cwd)
    directory = parent
  }
}

function isTargetAllowed(target: Word, cwd: string, root: string): boolean {
  if (target.isDynamic) return false
  const components = target.text.split('/')
  const hasHiddenGlob =
    target.hasGlob &&
    components.some(
      (component) =>
        component.startsWith('.') && GLOB_CHARACTER.test(component),
    )
  if (hasHiddenGlob) return false
  const relative = path.relative(root, path.resolve(cwd, target.text))
  const relativeComponents = relative.split(path.sep)
  return (
    relative !== '' &&
    !path.isAbsolute(relative) &&
    relativeComponents[0] !== '..' &&
    !relativeComponents.includes('.git')
  )
}

function isRemovalAllowed(words: readonly Word[], cwd: string): boolean {
  const targets: Word[] = []
  let haveOptionsEnded = false
  for (const argument of words) {
    if (!haveOptionsEnded && argument.text === '--') haveOptionsEnded = true
    else if (haveOptionsEnded || !argument.text.startsWith('-')) {
      targets.push(argument)
    }
  }
  const root = findRepositoryRoot(cwd)
  return (
    targets.length > 0 &&
    targets.every((target) => isTargetAllowed(target, cwd, root))
  )
}

function isNestedScriptAllowed(segment: Segment, cwd: string): boolean {
  const { words, heredocs } = segment
  const start = words.findIndex((word) => !isPrefixWord(word))
  if (commandName(words[start]) === 'eval') {
    const script = words.slice(start + 1).map((word) => word.text)
    return isAllowedRemoval(script.join(' '), cwd)
  }
  const shellIndex = findCommandIndex(words, SHELL_COMMANDS)
  if (shellIndex === -1) return true
  const flagIndex = words.findIndex(
    (word, index) => index > shellIndex && word.text === '-c',
  )
  const script = flagIndex === -1 ? undefined : words[flagIndex + 1]
  const scripts = [...heredocs, ...(script === undefined ? [] : [script.text])]
  return scripts.every((nested) => isAllowedRemoval(nested, cwd))
}

function isSegmentAllowed(segment: Segment, cwd: string): boolean {
  if (!isNestedScriptAllowed(segment, cwd)) return false
  const removalIndex = findCommandIndex(segment.words, REMOVE_COMMANDS)
  return (
    removalIndex === -1 ||
    isRemovalAllowed(segment.words.slice(removalIndex + 1), cwd)
  )
}

/**
 * Whether a Bash command is safe to run as far as `rm` is concerned. Every
 * `rm` in the command, including one behind `sudo`, `xargs`, `find -exec`,
 * `sh -c`, `eval`, a subshell or a command substitution, is allowed only when
 * each of its targets resolves strictly inside the repository or worktree
 * that contains `cwd` and is not `.git` or a path under it. A target that
 * cannot be resolved without a shell (a variable, `~`, a substitution, a
 * brace expansion, a glob that could match a dotfile) is blocked, and so is
 * an `rm` with no target. A command that cannot be parsed is blocked when it
 * mentions `rm`. A command that does not run `rm` (including `git rm`) is
 * always allowed.
 * @param command The Bash command line to check.
 * @param cwd The directory the command would run in.
 * @returns Whether the command may run.
 */
export function isAllowedRemoval(command: string, cwd: string): boolean {
  let segments: Segment[]
  try {
    segments = new ShellScanner(command).scan()
  } catch (error) {
    if (error instanceof UnparsableCommandError) {
      return !MENTIONS_RM.test(command)
    }
    throw error
  }
  return segments.every((segment) => isSegmentAllowed(segment, cwd))
}

function denyDecision(reason: string): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })
}

/**
 * The PreToolUse hook output for the JSON a hook receives on stdin.
 * @param hookInput The raw hook payload.
 * @returns A `deny` decision when the Bash command fails
 * {@link isAllowedRemoval} or the payload is not JSON, otherwise `undefined`
 * to stay silent and defer to the normal permission flow.
 */
export function decideRemovalGuard(hookInput: string): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(hookInput)
  } catch {
    return denyDecision('rm guard: the hook input is not valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const { tool_input: toolInput, cwd } = parsed as {
    tool_input?: { command?: unknown }
    cwd?: unknown
  }
  const command = toolInput?.command
  const directory = typeof cwd === 'string' ? cwd : process.cwd()
  return typeof command !== 'string' || isAllowedRemoval(command, directory)
    ? undefined
    : denyDecision(
        'rm guard: every rm target must resolve inside this repository or worktree and outside .git, and the command must be parsable without a shell; remove explicit in-repo paths or ask the user',
      )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = decideRemovalGuard(readFileSync(0, 'utf8'))
  if (output !== undefined) process.stdout.write(`${output}\n`)
}
