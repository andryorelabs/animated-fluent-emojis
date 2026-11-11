import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  acquireLock,
  didAcquireLock,
  findSkillsLockProblems,
  isLockStale,
  readLockHolder,
  releaseLock,
  type LockHolder,
  type SkillsLock,
} from './locks'

function deadPid(): number {
  const child = spawnSync(process.execPath, ['-e', '0'])
  return child.pid
}

const OPTIONS = {
  timeoutMs: 300,
  pollIntervalMs: 10,
  maxAgeMs: 60_000,
  logLabel: 'test',
}

describe('locks', () => {
  let workingDirectory: string
  let lockDirectory: string

  beforeEach(() => {
    workingDirectory = mkdtempSync(path.join(tmpdir(), 'locks-test-'))
    lockDirectory = path.join(workingDirectory, 'some.lock')
  })

  afterEach(() => {
    rmSync(workingDirectory, { recursive: true, force: true })
  })

  function buildHolder(overrides: Partial<LockHolder> = {}): LockHolder {
    return {
      pid: process.pid,
      worktree: workingDirectory,
      acquiredAt: Date.now(),
      ...overrides,
    }
  }

  it('acquires the lock and writes the holder payload', async () => {
    const holder = buildHolder()
    await acquireLock(lockDirectory, () => holder, OPTIONS)
    const raw = readFileSync(path.join(lockDirectory, 'holder.json'), 'utf8')
    expect(JSON.parse(raw)).toEqual(holder)
    expect(readLockHolder(lockDirectory)).toEqual(holder)
  })

  it('refuses a second acquire while the first holder is alive', async () => {
    expect(didAcquireLock(lockDirectory, buildHolder())).toBe(true)
    expect(didAcquireLock(lockDirectory, buildHolder())).toBe(false)
    await expect(
      acquireLock(lockDirectory, () => buildHolder(), OPTIONS),
    ).rejects.toThrow(/timed out after 300ms/)
  })

  it('rethrows an acquire error that is not a lock collision', () => {
    const missingParent = path.join(lockDirectory, 'missing', 'child.lock')
    expect(() => didAcquireLock(missingParent, buildHolder())).toThrow(/ENOENT/)
  })

  it('reclaims a lock whose holder pid is dead', async () => {
    didAcquireLock(lockDirectory, buildHolder({ pid: deadPid() }))
    await acquireLock(lockDirectory, () => buildHolder(), OPTIONS)
    expect(readLockHolder(lockDirectory)?.pid).toBe(process.pid)
  })

  it('does not reclaim a live holder that merely outlived maxAgeMs', () => {
    didAcquireLock(lockDirectory, buildHolder({ acquiredAt: 0 }))
    expect(isLockStale(lockDirectory, 1)).toBe(false)
  })

  it('reclaims an old lock whose worktree is gone', () => {
    didAcquireLock(
      lockDirectory,
      buildHolder({
        acquiredAt: 0,
        worktree: path.join(workingDirectory, 'missing'),
      }),
    )
    expect(isLockStale(lockDirectory, 1)).toBe(true)
  })

  it('treats a fresh holder-less directory as live and an old one as stale', () => {
    mkdirSync(lockDirectory)
    expect(isLockStale(lockDirectory, 60_000)).toBe(false)
    writeFileSync(path.join(lockDirectory, 'holder.json'), 'not json')
    expect(readLockHolder(lockDirectory)).toBeUndefined()
  })

  it('releases the lock so it can be acquired again', () => {
    didAcquireLock(lockDirectory, buildHolder())
    releaseLock(lockDirectory)
    expect(existsSync(lockDirectory)).toBe(false)
    expect(didAcquireLock(lockDirectory, buildHolder())).toBe(true)
  })
})

describe('skills lock', () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '..')
  const lock = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'skills-lock.json'), 'utf8'),
  ) as SkillsLock
  const vendoredSkills = readdirSync(
    path.join(repositoryRoot, '.claude', 'skills'),
    { withFileTypes: true },
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  const ref = 'a'.repeat(40)

  it('pins every skill to a commit and matches .claude/skills', () => {
    expect(Object.keys(lock.skills)).not.toHaveLength(0)
    expect(findSkillsLockProblems(lock, vendoredSkills)).toEqual([])
  })

  it('reports an entry without a full commit SHA in `ref`', () => {
    const problems = findSkillsLockProblems(
      { skills: { pinned: { ref }, missing: {}, short: { ref: 'e8a175d' } } },
      ['pinned', 'missing', 'short'],
    )
    expect(problems).toEqual([
      'missing: `ref` must be a full commit SHA',
      'short: `ref` must be a full commit SHA',
    ])
  })

  it('reports a skill that only one side lists', () => {
    const problems = findSkillsLockProblems(
      { skills: { locked: { ref }, both: { ref } } },
      ['both', 'vendored'],
    )
    expect(problems).toEqual([
      'locked: locked but missing from .claude/skills',
      'vendored: in .claude/skills but missing from the lock',
    ])
  })
})
