import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'

import { decideRemovalGuard, isAllowedRemoval } from './rm-guard'

const repository = mkdtempSync(path.join(tmpdir(), 'rm-guard-'))
const nested = path.join(repository, 'packages', 'library')
mkdirSync(path.join(repository, '.git'))
mkdirSync(nested, { recursive: true })

afterAll(() => {
  rmSync(repository, { recursive: true, force: true })
})

function blockedAmong(commands: readonly string[], cwd = repository): string[] {
  return commands.filter((command) => !isAllowedRemoval(command, cwd))
}

function allowedAmong(commands: readonly string[], cwd = repository): string[] {
  return commands.filter((command) => isAllowedRemoval(command, cwd))
}

function hookInput(command: string): string {
  return JSON.stringify({
    tool_name: 'Bash',
    cwd: repository,
    tool_input: { command },
  })
}

describe('isAllowedRemoval', () => {
  test('allows a path inside the repository', () => {
    const commands = [
      'rm file.txt',
      'rm -rf dist',
      'rm -rf -- dist apps/site/dist',
      `rm -rf ${repository}/node_modules/.cache`,
      'rm -rf "dir with space"',
      'rm dist/*.js',
      'rm -rf dist 2>/dev/null',
      'sudo rm -rf dist',
      'ls && rm -rf dist; echo done',
      '(rm -rf dist)',
    ]
    expect(blockedAmong(commands)).toEqual([])
  })

  test('resolves targets against the working directory', () => {
    expect(blockedAmong(['rm -rf dist', 'rm -rf ../../dist'], nested)).toEqual(
      [],
    )
    expect(
      allowedAmong(['rm -rf ../../..', 'rm -rf ../../.git'], nested),
    ).toEqual([])
  })

  test('blocks a path outside the repository', () => {
    const commands = [
      'rm -rf /',
      'rm /etc/hosts',
      'rm -rf /tmp/scratch',
      `rm -rf ${repository}-sibling`,
      'rm -rf dist /etc/hosts',
      'ls && rm /etc/hosts',
      'ls | xargs rm -rf /etc',
      '/bin/rm -rf /etc',
      String.raw`\rm -rf /etc`,
      'timeout 5 rm -rf /etc',
      'sudo -u root rm -rf /etc',
      'if true; then rm -rf /etc; fi',
      'echo "$(rm -rf /etc)"',
      'echo `rm -rf /etc`',
      'bash -c "rm -rf /etc"',
      'eval "rm -rf /etc"',
    ]
    expect(allowedAmong(commands)).toEqual([])
  })

  test('blocks the repository root itself', () => {
    const commands = ['rm -rf .', 'rm -rf ./', `rm -rf ${repository}`]
    expect(allowedAmong(commands)).toEqual([])
  })

  test('blocks `..` traversal out of the repository', () => {
    const commands = [
      'rm -rf ..',
      'rm -rf ../other',
      'rm -rf dist/../../other',
      'rm -rf ../*',
    ]
    expect(allowedAmong(commands)).toEqual([])
  })

  test('blocks `.git`', () => {
    const commands = [
      'rm -rf .git',
      'rm .git/index.lock',
      'rm -rf ./dist/../.git',
      `rm -rf ${repository}/.git`,
      'rm -rf .claude/worktrees/agent/.git',
      'rm -rf .*',
      'rm -rf .g*',
    ]
    expect(allowedAmong(commands)).toEqual([])
  })

  test('blocks a target it cannot resolve', () => {
    const commands = [
      'rm -rf $HOME',
      'rm -rf "$TARGET"',
      'rm -rf ~/code',
      'rm -rf $(pwd)',
      'rm -rf `pwd`',
      'rm -rf {dist,.git}',
      'find . -name "*.log" -exec rm {} +',
      'ls | xargs rm -rf',
      'rm -rf',
    ]
    expect(allowedAmong(commands)).toEqual([])
  })

  test('blocks an unparsable command that mentions rm', () => {
    const commands = [
      'rm -rf "dist',
      "rm -rf 'dist",
      'echo $(rm -rf dist',
      'echo `rm -rf dist',
      'cat <<EOF\nrm -rf dist',
      'rm dist <<',
    ]
    expect(allowedAmong(commands)).toEqual([])
  })

  test('never blocks a command that is not rm', () => {
    const commands = [
      '',
      'bun run check',
      'git rm -rf src',
      'sudo git rm -rf /etc',
      'echo rm -rf /',
      'grep -rn rm /etc',
      'git commit -m "rm -rf / is blocked; so is rm /etc"',
      String.raw`printf 'rm -rf /\n'`,
      'ls /etc # rm -rf /etc',
      'cat /etc/hosts > /tmp/hosts 2>&1',
      'npm run rm:all',
      'echo "unterminated',
      'case "$x" in a) echo one ;; esac',
      'find /etc -name "*.conf" -exec cat {} +',
    ]
    expect(blockedAmong(commands)).toEqual([])
  })

  test('skips a heredoc body unless a shell reads it', () => {
    const inert = [
      'git commit -m "$(cat <<\'EOF\'\nrm -rf /etc is now blocked\nEOF\n)"',
      'cat <<-EOF > notes.txt\n\trm -rf /etc\n\tEOF',
    ]
    expect(blockedAmong(inert)).toEqual([])
    expect(allowedAmong(['bash <<EOF\nrm -rf /etc\nEOF'])).toEqual([])
  })
})

describe('decideRemovalGuard', () => {
  test('emits a deny decision for a blocked removal', () => {
    const output = decideRemovalGuard(hookInput('rm -rf /etc'))
    const parsed = JSON.parse(output ?? '{}') as {
      hookSpecificOutput: Record<string, string>
    }
    expect(parsed.hookSpecificOutput).toMatchObject({
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
    })
  })

  test('stays silent for an allowed command', () => {
    expect(decideRemovalGuard(hookInput('rm -rf dist'))).toBeUndefined()
    expect(decideRemovalGuard(hookInput('ls'))).toBeUndefined()
  })

  test('stays silent when the input carries no command', () => {
    expect(decideRemovalGuard('{}')).toBeUndefined()
    expect(decideRemovalGuard('null')).toBeUndefined()
    expect(
      decideRemovalGuard(JSON.stringify({ tool_input: {} })),
    ).toBeUndefined()
  })

  test('denies hook input that is not JSON', () => {
    expect(decideRemovalGuard('not json')).toContain('"deny"')
  })

  test('runs as a hook script reading stdin', () => {
    const script = fileURLToPath(new URL('rm-guard.ts', import.meta.url))
    const run = (command: string) =>
      spawnSync('bun', [script], {
        encoding: 'utf8',
        input: hookInput(command),
      })
    expect(run('rm -rf /etc').stdout).toContain('"deny"')
    expect(run('rm -rf dist').stdout).toBe('')
  })
})
