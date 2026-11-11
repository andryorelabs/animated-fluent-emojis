import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const RETIRED_NAMES: readonly RegExp[] = [
  /\bforge\b/i,
  /AndryOre\/animated-fluent-emojis/,
]

const ALLOWED_PATHS: readonly { prefix: string; reason: string }[] = [
  { prefix: 'docs/adr/', reason: 'ADRs record the old names as history' },
  { prefix: 'CHANGELOG.md', reason: 'release notes record the old names' },
  {
    prefix: 'scripts/conventions/retired-names.test.ts',
    reason: 'the test names what it forbids',
  },
]

function listTrackedFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return output.split('\0').filter((entry) => entry !== '')
}

function readTextOrNull(relativePath: string): string | null {
  try {
    const content = readFileSync(path.join(ROOT, relativePath))
    return content.includes(0) ? null : content.toString('utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

describe('retired names', () => {
  test('appear in tracked files only on the allowlist', () => {
    const offenders = listTrackedFiles()
      .filter((file) =>
        ALLOWED_PATHS.every(({ prefix }) => !file.startsWith(prefix)),
      )
      .filter((file) => {
        const text = readTextOrNull(file)
        return text !== null && RETIRED_NAMES.some((name) => name.test(text))
      })
    expect(offenders).toEqual([])
  })
})
