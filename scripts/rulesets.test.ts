import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

import { listWorkflowFiles, readWorkflow } from './workflow-files.ts'

interface RequiredStatusCheck {
  readonly context: string
  readonly integration_id?: number
}

interface RulesetRule {
  readonly type: string
  readonly parameters?: {
    readonly required_status_checks?: readonly RequiredStatusCheck[]
  }
}

interface Ruleset {
  readonly name: string
  readonly bypass_actors: readonly unknown[]
  readonly rules: readonly RulesetRule[]
}

interface NamedJob {
  readonly name?: string
  readonly strategy?: { readonly matrix?: Record<string, unknown> }
}

const RULESETS_DIRECTORY = path.resolve(
  import.meta.dirname,
  '../.github/rulesets',
)
const MATRIX_EXPRESSION = /\$\{\{\s*matrix\.([\w-]+)\s*\}\}/

function readRuleset(fileName: string): Ruleset {
  return JSON.parse(
    readFileSync(path.join(RULESETS_DIRECTORY, fileName), 'utf8'),
  ) as Ruleset
}

function expandMatrixName(
  name: string,
  matrix: Record<string, unknown>,
): string[] {
  const match = MATRIX_EXPRESSION.exec(name)
  if (match === null) return [name]
  const [expression, key = ''] = match
  const values: unknown = matrix[key]
  return Array.isArray(values)
    ? values.flatMap((value: unknown) => {
        const expanded = name.replaceAll(expression, () => String(value))
        return expandMatrixName(expanded, matrix)
      })
    : [name]
}

function listWorkflowJobNames(): Set<string> {
  const names = new Set<string>()
  for (const fileName of listWorkflowFiles()) {
    const jobs: Record<string, NamedJob> = readWorkflow(fileName).jobs ?? {}
    for (const [jobId, job] of Object.entries(jobs)) {
      const matrix = job.strategy?.matrix ?? {}
      const expandedNames = expandMatrixName(job.name ?? jobId, matrix)
      for (const name of expandedNames) names.add(name)
    }
  }
  return names
}

function listRequiredChecks(ruleset: Ruleset): string[] {
  return ruleset.rules.flatMap((rule) =>
    (rule.parameters?.required_status_checks ?? []).map(
      (check) => check.context,
    ),
  )
}

describe('repository rulesets', () => {
  const jobNames = listWorkflowJobNames()

  test('every required check of the main ruleset is a workflow job name', () => {
    const requiredChecks = listRequiredChecks(readRuleset('main.json'))

    expect(requiredChecks).toEqual([
      'CI passed',
      'Validate PR title',
      'Check markdown links',
    ])
    expect(requiredChecks.filter((check) => !jobNames.has(check))).toEqual([])
  })

  test('matrix job names are expanded to the names GitHub reports', () => {
    const expanded = expandMatrixName(
      'Shard ${{ matrix.shard }} on ${{ matrix.os }}',
      { shard: [1, 2], os: ['linux'] },
    )

    expect(expanded).toEqual(['Shard 1 on linux', 'Shard 2 on linux'])
    expect([...jobNames].filter((name) => name.includes('${{'))).toEqual([])
  })

  test.each(['main.json', 'tags.json'])(
    '%s has no bypass actors',
    (fileName) => {
      expect(readRuleset(fileName).bypass_actors).toEqual([])
    },
  )
})
