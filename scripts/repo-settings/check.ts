import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import {
  diffSettings,
  readExpectedSettings,
  readLiveSettings,
  type GhRunner,
  type RepositorySettings,
  type SettingDifference,
} from './settings.ts'

interface RepositorySettingsCheckDependencies {
  readonly run: GhRunner
  readonly report: (line: string) => void
  readonly expected: RepositorySettings
}

const executeFile = promisify(execFile)

async function runGh(commandArguments: string[]): Promise<string> {
  const { stdout } = await executeFile('gh', commandArguments, {
    maxBuffer: 16 * 1024 * 1024,
  })
  return stdout
}

function defaultDependencies(): RepositorySettingsCheckDependencies {
  return {
    run: runGh,
    report: (line) => {
      console.log(line)
    },
    expected: readExpectedSettings(),
  }
}

function describeValue(value: SettingDifference['expected']): string {
  return value === undefined ? 'absent' : JSON.stringify(value)
}

/**
 * Formats one difference as a report line.
 * @param difference The differing value.
 * @returns The path with the expected and the live value.
 */
export function formatDifference(difference: SettingDifference): string {
  const expected = describeValue(difference.expected)
  const live = describeValue(difference.live)
  return `${difference.path}: expected ${expected}, live ${live}`
}

/**
 * Compares the live GitHub settings with the repository files and reports
 * each difference. It only reads from GitHub.
 * @param dependencies The `gh` runner, the reporter and the expected settings, defaulting to the real ones.
 * @returns 0 when live matches the files, 1 when there is any difference.
 */
export async function runRepositorySettingsCheck(
  dependencies: RepositorySettingsCheckDependencies = defaultDependencies(),
): Promise<number> {
  const live = await readLiveSettings(dependencies.run)
  const differences = diffSettings(dependencies.expected, live)
  if (differences.length === 0) {
    dependencies.report('repo-settings: live settings match the files.')
    return 0
  }
  for (const difference of differences) {
    dependencies.report(`repo-settings: ${formatDifference(difference)}`)
  }
  dependencies.report(
    `repo-settings: ${String(differences.length)} difference(s). Re-apply from the files, see docs/brand/apply-spec.md.`,
  )
  return 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await runRepositorySettingsCheck()
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
