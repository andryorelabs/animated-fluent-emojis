import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

import {
  diffSettings,
  EXPECTED_REPOSITORY_SETTINGS,
  readExpectedSettings,
  readLiveSettings,
  type JsonObject,
  type RepositorySettings,
} from './settings.ts'

const REPOSITORY_ENDPOINT = 'repos/andryorelabs/animated-fluent-emojis'

const EXPECTED_RULES: readonly JsonObject[] = [
  { type: 'deletion' },
  {
    type: 'pull_request',
    parameters: {
      dismiss_stale_reviews_on_push: true,
      allowed_merge_methods: ['squash'],
    },
  },
  {
    type: 'required_status_checks',
    parameters: {
      required_status_checks: [
        { context: 'CI passed', integration_id: 15_368 },
        { context: 'Validate PR title', integration_id: 15_368 },
      ],
    },
  },
]

const EXPECTED_MAIN: JsonObject = {
  name: 'main',
  enforcement: 'active',
  bypass_actors: [],
  rules: EXPECTED_RULES,
}

const EXPECTED: RepositorySettings = {
  settings: { allow_squash_merge: true, homepage: 'https://example.test' },
  rulesets: { main: EXPECTED_MAIN },
}

const LIVE_REPOSITORY_RESPONSE = {
  id: 1,
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  squash_merge_commit_title: 'PR_TITLE',
  squash_merge_commit_message: 'PR_BODY',
  delete_branch_on_merge: true,
  allow_auto_merge: true,
  allow_update_branch: true,
  has_wiki: false,
  has_projects: false,
  has_discussions: false,
  homepage: '',
  security_and_analysis: {
    secret_scanning: { status: 'disabled' },
    secret_scanning_push_protection: { status: 'enabled' },
    dependabot_security_updates: { status: 'enabled' },
  },
}

const LIVE_RULESET_RESPONSE = {
  id: 7,
  name: 'tags',
  target: 'tag',
  source_type: 'Repository',
  enforcement: 'active',
  conditions: { ref_name: { exclude: [], include: ['refs/tags/v*'] } },
  rules: [{ type: 'deletion' }],
  node_id: 'RRS_1',
  bypass_actors: [],
  current_user_can_bypass: 'never',
}

function withRuleset(ruleset: JsonObject): RepositorySettings {
  return { settings: EXPECTED.settings, rulesets: { main: ruleset } }
}

function createRunner(responses: Readonly<Record<string, unknown>>): {
  readonly calls: string[][]
  readonly run: (commandArguments: string[]) => Promise<string>
} {
  const calls: string[][] = []
  return {
    calls,
    run: (commandArguments) => {
      calls.push(commandArguments)
      const endpoint = commandArguments.at(-1) ?? ''
      return Object.hasOwn(responses, endpoint)
        ? Promise.resolve(JSON.stringify(responses[endpoint]))
        : Promise.reject(new Error(`unexpected endpoint ${endpoint}`))
    },
  }
}

const LIVE_RESPONSES = {
  [REPOSITORY_ENDPOINT]: LIVE_REPOSITORY_RESPONSE,
  [`${REPOSITORY_ENDPOINT}/private-vulnerability-reporting`]: { enabled: true },
  [`${REPOSITORY_ENDPOINT}/rulesets`]: [{ id: 7, name: 'tags' }],
  [`${REPOSITORY_ENDPOINT}/rulesets/7`]: LIVE_RULESET_RESPONSE,
}

describe('diffSettings', () => {
  test('reports nothing when live matches the files', () => {
    expect(diffSettings(EXPECTED, EXPECTED)).toEqual([])
  })

  test('ignores the defaults and the ordering GitHub adds to a response', () => {
    const live: RepositorySettings = {
      settings: { ...EXPECTED.settings, has_issues: true },
      rulesets: {
        main: {
          id: 7,
          name: 'main',
          enforcement: 'active',
          bypass_actors: [],
          rules: [
            {
              type: 'required_status_checks',
              parameters: {
                do_not_enforce_on_create: false,
                required_status_checks: [
                  { context: 'Validate PR title', integration_id: 15_368 },
                  { context: 'CI passed', integration_id: 15_368 },
                ],
              },
            },
            {
              type: 'pull_request',
              parameters: {
                dismiss_stale_reviews_on_push: true,
                required_reviewers: [],
                allowed_merge_methods: ['squash'],
              },
            },
            { type: 'deletion' },
          ],
        },
      },
    }

    expect(diffSettings(EXPECTED, live)).toEqual([])
  })

  test('names a setting whose live value differs or is missing', () => {
    const live: RepositorySettings = {
      settings: { allow_squash_merge: false },
      rulesets: EXPECTED.rulesets,
    }

    expect(diffSettings(EXPECTED, live)).toEqual([
      { path: 'settings.allow_squash_merge', expected: true, live: false },
      {
        path: 'settings.homepage',
        expected: 'https://example.test',
        live: undefined,
      },
    ])
  })

  test('names a rule parameter, a missing rule and a missing required check', () => {
    const live = withRuleset({
      name: 'main',
      enforcement: 'active',
      bypass_actors: [],
      rules: [
        {
          type: 'pull_request',
          parameters: {
            dismiss_stale_reviews_on_push: false,
            allowed_merge_methods: ['squash', 'rebase'],
          },
        },
        {
          type: 'required_status_checks',
          parameters: {
            required_status_checks: [
              { context: 'CI passed', integration_id: 15_368 },
            ],
          },
        },
      ],
    })

    expect(diffSettings(EXPECTED, live)).toEqual([
      {
        path: 'rulesets.main.rules[deletion]',
        expected: { type: 'deletion' },
        live: undefined,
      },
      {
        path: 'rulesets.main.rules[pull_request].parameters.dismiss_stale_reviews_on_push',
        expected: true,
        live: false,
      },
      {
        path: 'rulesets.main.rules[pull_request].parameters.allowed_merge_methods',
        expected: ['squash'],
        live: ['squash', 'rebase'],
      },
      {
        path: 'rulesets.main.rules[required_status_checks].parameters.required_status_checks[Validate PR title]',
        expected: { context: 'Validate PR title', integration_id: 15_368 },
        live: undefined,
      },
    ])
  })

  test('treats a rule, a bypass actor or a ruleset that only exists live as drift', () => {
    const bypassActor = { actor_id: 5, actor_type: 'RepositoryRole' }
    const extraRule = { type: 'creation' }
    const live: RepositorySettings = {
      settings: EXPECTED.settings,
      rulesets: {
        main: {
          ...EXPECTED_MAIN,
          bypass_actors: [bypassActor],
          rules: [...EXPECTED_RULES, extraRule],
        },
        legacy: { name: 'legacy' },
      },
    }

    expect(diffSettings(EXPECTED, live)).toEqual([
      {
        path: 'rulesets.main.bypass_actors',
        expected: [],
        live: [bypassActor],
      },
      {
        path: 'rulesets.main.rules[creation]',
        expected: undefined,
        live: extraRule,
      },
      {
        path: 'rulesets.legacy',
        expected: undefined,
        live: { name: 'legacy' },
      },
    ])
  })

  test('names a ruleset that is missing on GitHub', () => {
    const live: RepositorySettings = {
      settings: EXPECTED.settings,
      rulesets: {},
    }

    expect(diffSettings(EXPECTED, live)).toEqual([
      {
        path: 'rulesets.main',
        expected: EXPECTED.rulesets.main,
        live: undefined,
      },
    ])
  })
})

describe('readLiveSettings', () => {
  test('maps the GitHub responses to the tracked settings and rulesets', async () => {
    const runner = createRunner(LIVE_RESPONSES)

    const live = await readLiveSettings(runner.run)

    expect(live.settings).toEqual({
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      squash_merge_commit_title: 'PR_TITLE',
      squash_merge_commit_message: 'PR_BODY',
      delete_branch_on_merge: true,
      allow_auto_merge: true,
      allow_update_branch: true,
      has_wiki: false,
      has_projects: false,
      has_discussions: false,
      homepage: '',
      'security_and_analysis.secret_scanning.status': 'disabled',
      'security_and_analysis.secret_scanning_push_protection.status': 'enabled',
      'security_and_analysis.dependabot_security_updates.status': 'enabled',
      'private_vulnerability_reporting.enabled': true,
    })
    expect(live.rulesets).toEqual({
      tags: {
        name: 'tags',
        target: 'tag',
        enforcement: 'active',
        conditions: { ref_name: { exclude: [], include: ['refs/tags/v*'] } },
        bypass_actors: [],
        rules: [{ type: 'deletion' }],
      },
    })
  })

  test('only sends GET requests', async () => {
    const runner = createRunner(LIVE_RESPONSES)

    await readLiveSettings(runner.run)

    expect(runner.calls).toHaveLength(4)
    for (const call of runner.calls) {
      expect(call.slice(0, 3)).toEqual(['api', '--method', 'GET'])
      expect(call).toHaveLength(4)
    }
  })

  test('leaves out a setting the response does not carry', async () => {
    const runner = createRunner({
      ...LIVE_RESPONSES,
      [REPOSITORY_ENDPOINT]: { allow_squash_merge: true },
      [`${REPOSITORY_ENDPOINT}/rulesets`]: [],
    })

    const live = await readLiveSettings(runner.run)

    expect(live).toEqual({
      settings: {
        allow_squash_merge: true,
        'private_vulnerability_reporting.enabled': true,
      },
      rulesets: {},
    })
  })

  test.each([
    ['the repository is not an object', { [REPOSITORY_ENDPOINT]: [] }],
    [
      'the rulesets are not a list',
      { [`${REPOSITORY_ENDPOINT}/rulesets`]: {} },
    ],
    [
      'a listed ruleset has no id',
      { [`${REPOSITORY_ENDPOINT}/rulesets`]: [{ name: 'tags' }] },
    ],
    [
      'a ruleset has no name',
      { [`${REPOSITORY_ENDPOINT}/rulesets/7`]: { id: 7 } },
    ],
  ])('fails when %s', async (_case, overrides) => {
    const runner = createRunner({ ...LIVE_RESPONSES, ...overrides })

    await expect(readLiveSettings(runner.run)).rejects.toThrow(
      /^repo-settings: /,
    )
  })
})

describe('readExpectedSettings', () => {
  const temporaryDirectories: string[] = []

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  function createRulesetsDirectory(content: string): string {
    const directory = mkdtempSync(path.join(tmpdir(), 'repo-settings-'))
    temporaryDirectories.push(directory)
    writeFileSync(path.join(directory, 'broken.json'), content)
    return directory
  }

  test('reads the settings list and the ruleset files of this repository', () => {
    const expected = readExpectedSettings()

    expect(expected.settings).toBe(EXPECTED_REPOSITORY_SETTINGS)
    expect(Object.keys(expected.rulesets)).toEqual(['main', 'tags'])
    expect(expected.rulesets.tags).toMatchObject({
      target: 'tag',
      conditions: { ref_name: { include: ['refs/tags/v*'] } },
    })
  })

  test.each([
    ['is not an object', '[]'],
    ['has no name', '{"target":"branch"}'],
  ])('fails when a ruleset file %s', (_case, content) => {
    const directory = createRulesetsDirectory(content)

    expect(() => readExpectedSettings(directory)).toThrow(
      /^repo-settings: broken\.json/,
    )
  })
})

describe('docs/brand/apply-spec.md', () => {
  const applySpec = readFileSync(
    path.resolve(import.meta.dirname, '../../docs/brand/apply-spec.md'),
    'utf8',
  )

  test.each(Object.entries(EXPECTED_REPOSITORY_SETTINGS))(
    'lists %s with its expected value',
    (key, value) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value)

      expect(applySpec).toContain(`| \`${key}\``)
      expect(applySpec).toContain(`\`${text}\``)
    },
  )
})
