import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

import {
  listWorkflowFiles,
  readWorkflow,
  type Workflow,
  type WorkflowStep,
} from './workflow-files'

const FULL_SHA_PATTERN = /^[\da-f]{40}$/

function collectSteps(workflow: Workflow): WorkflowStep[] {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? [])
}

function collectUses(workflow: Workflow): string[] {
  const jobUses = Object.values(workflow.jobs ?? {}).flatMap(
    (job) => job.uses ?? [],
  )
  const stepUses = collectSteps(workflow).flatMap((step) => step.uses ?? [])
  return [...jobUses, ...stepUses]
}

function triggerNames(workflow: Workflow): string[] {
  const trigger = workflow.on
  if (typeof trigger === 'string') return [trigger]
  if (Array.isArray(trigger)) return trigger.map(String)
  return trigger !== null && typeof trigger === 'object'
    ? Object.keys(trigger)
    : []
}

const NODE_VERSION_FILE = '.node-version'

function isPermissionsMap(permissions: unknown): boolean {
  return (
    permissions !== null &&
    typeof permissions === 'object' &&
    !Array.isArray(permissions)
  )
}

function jobsWithoutOwnPermissions(workflow: Workflow): string[] {
  return Object.entries(workflow.jobs ?? {})
    .filter(([, job]) => !isPermissionsMap(job.permissions))
    .map(([jobName]) => jobName)
}

type WorkflowWithConcurrency = Workflow & { readonly concurrency?: unknown }

function concurrencyGroup({ concurrency }: WorkflowWithConcurrency): unknown {
  if (typeof concurrency === 'string') return concurrency
  return concurrency !== null && typeof concurrency === 'object'
    ? (concurrency as { readonly group?: unknown }).group
    : undefined
}

function isMissingConcurrencyGroup(workflow: WorkflowWithConcurrency): boolean {
  const group = concurrencyGroup(workflow)
  return typeof group !== 'string' || group.trim() === ''
}

function describeNodeSource(step: WorkflowStep): string {
  return JSON.stringify({
    'node-version': step.with?.['node-version'],
    'node-version-file': step.with?.['node-version-file'],
  })
}

function nodeSourceViolations(workflow: Workflow): string[] {
  return Object.entries(workflow.jobs ?? {}).flatMap(([jobName, job]) => {
    const steps = job.steps ?? []
    const checksOut = steps.some((step) =>
      step.uses?.startsWith('actions/checkout@'),
    )
    return steps
      .filter((step) => step.uses?.startsWith('actions/setup-node@'))
      .filter((step) => {
        const file = step.with?.['node-version-file']
        const readsFile = checksOut
          ? file === NODE_VERSION_FILE
          : typeof file === 'string' && file !== ''
        return step.with?.['node-version'] !== undefined || !readsFile
      })
      .map((step) => `${jobName}: ${describeNodeSource(step)}`)
  })
}

test('there is at least one workflow to check', () => {
  expect(listWorkflowFiles().length).toBeGreaterThan(0)
})

test('.node-version pins the Node major the workflows install', () => {
  const nodeVersion = readFileSync(
    fileURLToPath(new URL(`../${NODE_VERSION_FILE}`, import.meta.url)),
    'utf8',
  )
  expect(nodeVersion.trim()).toBe('24')
})

describe('job permissions check', () => {
  test('reports a job that inherits the workflow permissions', () => {
    const workflow: Workflow = {
      jobs: {
        scoped: { permissions: { contents: 'read' } },
        empty: { permissions: {} },
        inherited: {},
        shorthand: { permissions: 'write-all' },
      },
    }
    expect(jobsWithoutOwnPermissions(workflow)).toEqual([
      'inherited',
      'shorthand',
    ])
  })
})

describe('Node version source check', () => {
  const setupNode =
    'actions/setup-node@0000000000000000000000000000000000000000'
  const checkout = 'actions/checkout@0000000000000000000000000000000000000000'

  test('reports a literal version and a file other than .node-version', () => {
    const workflow: Workflow = {
      jobs: {
        literal: {
          steps: [
            { uses: checkout },
            { uses: setupNode, with: { 'node-version': 24 } },
          ],
        },
        'other-file': {
          steps: [
            { uses: checkout },
            { uses: setupNode, with: { 'node-version-file': 'package.json' } },
          ],
        },
        unset: { steps: [{ uses: setupNode }] },
        pinned: {
          steps: [
            { uses: checkout },
            {
              uses: setupNode,
              with: { 'node-version-file': NODE_VERSION_FILE },
            },
          ],
        },
        'from-artifact': {
          steps: [
            {
              uses: setupNode,
              with: { 'node-version-file': 'artifact/node-version' },
            },
          ],
        },
      },
    }
    expect(nodeSourceViolations(workflow)).toEqual([
      'literal: {"node-version":24}',
      'other-file: {"node-version-file":"package.json"}',
      'unset: {}',
    ])
  })
})

describe('concurrency check', () => {
  test.each([
    ['no concurrency', {}, true],
    ['an empty group', { concurrency: { group: ' ' } }, true],
    ['only cancel-in-progress', { concurrency: {} }, true],
    ['a group', { concurrency: { group: 'ci-${{ github.ref }}' } }, false],
    ['the string shorthand', { concurrency: 'ci' }, false],
  ])('%s', (_label, workflow, missing) => {
    expect(isMissingConcurrencyGroup(workflow)).toBe(missing)
  })
})

describe.each(listWorkflowFiles())('%s', (fileName) => {
  const workflow = readWorkflow(fileName)

  test('every job declares its own permissions', () => {
    expect(jobsWithoutOwnPermissions(workflow)).toEqual([])
  })

  test('every actions/setup-node reads the version from a file', () => {
    expect(nodeSourceViolations(workflow)).toEqual([])
  })

  test.runIf(triggerNames(workflow).includes('pull_request'))(
    'declares a concurrency group because pull requests trigger it',
    () => {
      expect(isMissingConcurrencyGroup(workflow)).toBe(false)
    },
  )

  test('does not use the pull_request_target trigger', () => {
    expect(triggerNames(workflow)).not.toContain('pull_request_target')
  })

  test('every job sets timeout-minutes', () => {
    const jobs = Object.entries(workflow.jobs ?? {})
    for (const [jobName, job] of jobs) {
      expect(job['timeout-minutes'], `job "${jobName}"`).toBeTypeOf('number')
    }
  })

  test('top-level permissions are contents: read or empty', () => {
    expect([{ contents: 'read' }, {}]).toContainEqual(workflow.permissions)
  })

  test('every actions/checkout sets persist-credentials: false', () => {
    const checkoutSteps = collectSteps(workflow).filter((step) =>
      step.uses?.startsWith('actions/checkout@'),
    )
    for (const step of checkoutSteps) {
      expect(step.with?.['persist-credentials']).toBe(false)
    }
  })

  test('every external action is pinned to a 40-hex SHA', () => {
    const externalUses = collectUses(workflow).filter(
      (uses) => !uses.startsWith('./'),
    )
    for (const uses of externalUses) {
      const reference = uses.split('@', 2)[1] ?? ''
      expect(reference, uses).toMatch(FULL_SHA_PATTERN)
    }
  })
})

describe('sync-assets.yml docs pull request step', () => {
  const steps = collectSteps(readWorkflow('sync-assets.yml'))
  const script =
    steps.find((step) => step.run?.includes('gh pr create'))?.run ?? ''

  test('reuses only an open pull request', () => {
    expect(script).toMatch(/gh pr list[^\n]*--state open/)
    expect(script).not.toContain('gh pr view')
  })

  test('counts untracked docs files as changes', () => {
    expect(script).toContain('git status --porcelain -- docs')
    expect(script).not.toContain('git diff --quiet')
  })

  test('does not interpolate expressions into the script', () => {
    expect(script).not.toContain('${{')
  })
})

describe('sync-assets.yml build step', () => {
  const steps = collectSteps(readWorkflow('sync-assets.yml'))
  const script =
    steps.find((step) => step.run?.includes('assets:build'))?.run ?? ''

  test('forwards bypass_guards to the build and never rebuild', () => {
    expect(script).toContain('--bypass-guards')
    expect(script).toContain('BYPASS_GUARDS')
    expect(script).not.toContain('--force')
  })

  test('does not interpolate expressions into the script', () => {
    expect(script).not.toContain('${{')
  })
})

describe('sync-assets.yml dispatch inputs', () => {
  const workflow = readWorkflow('sync-assets.yml')
  const raw = JSON.stringify(workflow)

  test('splits force into rebuild and bypass_guards and drops smoke_v1', () => {
    expect(raw).toContain('"rebuild"')
    expect(raw).toContain('"bypass_guards"')
    expect(raw).not.toContain('"force"')
    expect(raw).not.toContain('smoke_v1')
  })
})

describe('sync-assets.yml failure report job', () => {
  const workflow = readWorkflow('sync-assets.yml')
  const job = workflow.jobs?.['report-failure']

  test('runs only on failure and depends on every other job', () => {
    expect(job?.if).toBe('failure()')
    expect(job?.needs).toEqual(['sync', 'emoji-lists'])
  })

  test('has only issues: write permission', () => {
    expect(job?.permissions).toEqual({ issues: 'write' })
  })

  test('depends on the sync job that holds the smoke steps', () => {
    const sync = readWorkflow('sync-assets.yml').jobs?.sync
    const smokeSteps = (sync?.steps ?? []).filter((step) =>
      step.name?.startsWith('Smoke test'),
    )
    expect(smokeSteps.length).toBeGreaterThanOrEqual(2)
    expect(job?.needs).toContain('sync')
  })

  test('is, with resolve-failure, the only job granted issues: write', () => {
    const writers = Object.entries(workflow.jobs ?? {})
      .filter(([, other]) =>
        JSON.stringify(other.permissions ?? {}).includes('issues'),
      )
      .map(([name]) => name)
    expect(writers).toEqual(['report-failure', 'resolve-failure'])
  })

  test('does not interpolate expressions into the script', () => {
    const script = job?.steps?.map((step) => step.run ?? '').join('\n') ?? ''
    expect(script).toContain('gh issue')
    expect(script).not.toContain('${{')
  })
})

describe('sync-assets.yml smoke steps', () => {
  const steps = collectSteps(readWorkflow('sync-assets.yml'))
  const legacy = steps.find(
    (step) => step.name === 'Smoke test the legacy layout',
  )
  const v1 = steps.find((step) => step.name === 'Smoke test the v1 layout')

  test('checks the legacy manifest and a legacy sprite', () => {
    expect(legacy?.run).toContain('/manifest.slim.json')
    expect(legacy?.run).toContain('/sprites/')
  })

  test('retries every legacy request', () => {
    const requests = (legacy?.run ?? '')
      .split('\n')
      .filter((line) => line.includes('curl '))
    expect(requests.length).toBeGreaterThanOrEqual(2)
    for (const line of requests) expect(line).toContain('--retry 5')
  })

  test('polls the v1 builtAt check in a bounded loop', () => {
    expect(v1?.run).toMatch(/for \w+ in \$\(seq 1 \d+\)/)
    expect(v1?.run).toContain('sleep ')
  })

  test('always runs the v1 checks, including builtAt and an @2x sprite', () => {
    expect(v1?.if).not.toContain('smoke_v1')
    expect(v1?.run).toContain('/v1/version.json')
    expect(v1?.run).toContain('builtAt')
    expect(v1?.run).toContain('/v1/manifest.slim.json')
    expect(v1?.run).toContain('/v1/sprites/')
    expect(v1?.run).toContain('@2x.png')
  })

  test('retries every v1 request', () => {
    const requests = (v1?.run ?? '')
      .split('\n')
      .filter((line) => line.includes('curl '))
    expect(requests.length).toBeGreaterThanOrEqual(4)
    for (const line of requests) expect(line).toContain('--retry 5')
  })

  test('does not interpolate expressions into the scripts', () => {
    expect(legacy?.run).not.toContain('${{')
    expect(v1?.run).not.toContain('${{')
  })
})

describe('sync-assets.yml sync job', () => {
  const workflow = readWorkflow('sync-assets.yml')
  const job = workflow.jobs?.sync
  const steps = job?.steps ?? []

  test('runs the smoke steps whenever detect succeeded, even if unchanged', () => {
    for (const name of [
      'Smoke test the legacy layout',
      'Smoke test the v1 layout',
    ]) {
      const step = steps.find((candidate) => candidate.name === name)
      expect(step, name).toBeDefined()
      expect(step?.if ?? '', name).not.toContain('changed')
    }
  })

  test('the v1 smoke only compares builtAt when a local build exists', () => {
    const v1 = steps.find((step) => step.name === 'Smoke test the v1 layout')
    expect(v1?.run).toContain('-f apps/assets/dist-assets/v1/version.json')
  })

  test('pins an exact wrangler version', () => {
    const deploy = steps.find((step) =>
      step.uses?.startsWith('cloudflare/wrangler-action@'),
    )
    expect(String(deploy?.with?.wranglerVersion)).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test('detect compares the files site', () => {
    const detect = steps.find((step) => step.id === 'detect')
    expect(detect?.run).toContain('--files-url "${FILES_URL}"')
    expect(detect?.env?.FILES_URL).toBe(
      'https://animated-fluent-emojis-files.andryore.dev',
    )
  })

  test('builds then deploys the files site after the asset deploy', () => {
    const names = steps.map((step) => step.name)
    const assetDeploy = names.indexOf('Deploy to Cloudflare Pages')
    const build = names.indexOf('Build the files site')
    const deploy = names.indexOf('Deploy the files site to Cloudflare Pages')
    expect(assetDeploy).toBeGreaterThan(-1)
    expect(build).toBeGreaterThan(assetDeploy)
    expect(deploy).toBeGreaterThan(build)
    expect(steps[build]?.run).toContain('bun run assets:files')
    expect(steps[build]?.if).toContain('changed')
  })

  test('the files deploy targets its own project with the same token', () => {
    const deploy = steps.find(
      (step) => step.name === 'Deploy the files site to Cloudflare Pages',
    )
    expect(deploy?.uses).toMatch(/^cloudflare\/wrangler-action@[0-9a-f]{40}$/)
    expect(String(deploy?.with?.command)).toContain(
      'pages deploy apps/assets/dist-files',
    )
    expect(String(deploy?.with?.command)).toContain(
      '--project-name=animated-fluent-emojis-files',
    )
    expect(String(deploy?.with?.command)).toContain('--branch=main')
    expect(String(deploy?.with?.apiToken)).toContain('CLOUDFLARE_API_TOKEN')
    expect(String(deploy?.with?.wranglerVersion)).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test('smoke tests the files site with retries on every request', () => {
    const smoke = steps.find(
      (step) => step.name === 'Smoke test the files site',
    )
    expect(smoke).toBeDefined()
    expect(smoke?.if ?? '').not.toContain('changed')
    expect(smoke?.env?.FILES_SITE_URL).toBe(
      'https://animated-fluent-emojis-files.andryore.dev',
    )
    expect(smoke?.run).toContain('/version.json')
    expect(smoke?.run).toContain('/index.json')
    for (const format of ['gif', 'webp', 'png'])
      expect(smoke?.run).toContain(format)
    const requests = (smoke?.run ?? '')
      .split('\n')
      .filter((line) => line.includes('curl '))
    expect(requests.length).toBeGreaterThanOrEqual(3)
    for (const line of requests) expect(line).toContain('--retry 5')
    expect(smoke?.run).not.toContain('${{')
  })

  test('allows at least 90 minutes for a full rebuild', () => {
    expect(Number(job?.['timeout-minutes'])).toBeGreaterThanOrEqual(90)
  })

  test('does not restore a cache in the job that deploys', () => {
    expect(steps.some((step) => step.uses?.startsWith('actions/cache@'))).toBe(
      false,
    )
  })
})

describe('sync-assets.yml emoji-lists job', () => {
  const job = readWorkflow('sync-assets.yml').jobs?.['emoji-lists']

  test('runs whenever sync did not fail, regardless of changed', () => {
    expect(job?.needs).toBe('sync')
    expect(job?.if ?? '').not.toContain('changed')
  })
  const runs = job?.steps?.map((step) => step.run ?? '').join('\n') ?? ''

  test('installs without running lifecycle scripts', () => {
    expect(runs).toContain('bun install --frozen-lockfile --ignore-scripts')
  })

  test('retries the manifest fetch', () => {
    const fetchLine =
      runs.split('\n').find((line) => line.includes('curl ')) ?? ''
    expect(fetchLine).toContain('--retry 5')
  })

  test('downloads the live index and stages the slug registry', () => {
    expect(runs).toContain(
      'animated-fluent-emojis-files.andryore.dev/index.json',
    )
    expect(runs).toContain('--index "${GITHUB_WORKSPACE}/index.json"')
    expect(runs).toContain('--manifest "${GITHUB_WORKSPACE}/manifest.json"')
    expect(runs).toContain('"404"')
    expect(runs).toContain(
      'git status --porcelain -- docs packages/animated-fluent-emojis/src/utils/emoji-id.generated.ts apps/assets/public-slugs.json',
    )
    expect(runs).toContain(
      'paths=(CHANGELOG.md docs packages/animated-fluent-emojis/src/utils/emoji-id.generated.ts apps/assets/public-slugs.json)',
    )
  })

  test('commits through the API so GitHub signs the commit', () => {
    expect(runs).toContain('createCommitOnBranch')
    expect(runs).not.toContain('git commit')
    expect(runs).not.toContain('git push')
    expect(runs).not.toContain('x-access-token')
  })

  test('opens the pull request with the personal token, not GITHUB_TOKEN', () => {
    const openStep = job?.steps?.find((step) =>
      step.run?.includes('createCommitOnBranch'),
    )
    expect(openStep?.env?.GH_TOKEN).toBe('${{ secrets.LISTS_BOT_TOKEN }}')
    expect(job?.permissions).toEqual({ contents: 'read' })
    expect(runs).not.toContain('gh workflow run')
    expect(runs).toContain('gh pr merge')
  })

  test('appends a changelog entry under Unreleased when EmojiId changes', () => {
    expect(runs).toContain(
      'packages/animated-fluent-emojis/src/utils/emoji-id.generated.ts',
    )
    expect(runs).toContain(String.raw`## \[Unreleased\]`)
    expect(runs).toContain('CHANGELOG.md')
  })

  test('checks duplicates only inside the Unreleased section', () => {
    expect(runs).toContain('unreleased="$(awk')
    expect(runs).toContain('-- "${entry}" <<< "${unreleased}"')
    expect(runs).not.toContain('"${entry}" CHANGELOG.md')
  })

  test('inserts the entry under ### Changed, creating it when missing', () => {
    expect(runs).toContain('/^### Changed/')
    expect(runs).toContain('print "### Changed"')
  })
})

describe('sync-assets.yml failure resolution job', () => {
  const job = readWorkflow('sync-assets.yml').jobs?.['resolve-failure']

  test('runs after a sync that did not fail, with only issues: write', () => {
    expect(job?.if).toBe('${{ !failure() && !cancelled() }}')
    expect(job?.needs).toEqual(['sync', 'emoji-lists'])
    expect(job?.permissions).toEqual({ issues: 'write' })
  })

  test('closes the open failure issue without interpolating expressions', () => {
    const script = job?.steps?.map((step) => step.run ?? '').join('\n') ?? ''
    expect(script).toContain('gh issue close')
    expect(script).toContain('sync-assets failing')
    expect(script).not.toContain('${{')
  })
})

describe('release.yml job split', () => {
  const workflow = readWorkflow('release.yml')
  const verify = workflow.jobs?.verify
  const publish = workflow.jobs?.publish
  const publishScript =
    publish?.steps?.map((step) => step.run ?? '').join('\n') ?? ''
  const verifyScript =
    verify?.steps?.map((step) => step.run ?? '').join('\n') ?? ''

  test('id-token: write appears only in the publish job', () => {
    const writers = Object.entries(workflow.jobs ?? {})
      .filter(([, job]) =>
        JSON.stringify(job.permissions ?? {}).includes('id-token'),
      )
      .map(([name]) => name)
    expect(writers).toEqual(['publish'])
    expect(publish?.permissions).toEqual({
      contents: 'write',
      'id-token': 'write',
    })
  })

  test('verify is read-only and runs the full quality gate', () => {
    expect(verify?.permissions).toEqual({ contents: 'read', checks: 'read' })
    for (const command of [
      'bun ci',
      'bun run check',
      'bun run test',
      'bun run build',
    ]) {
      expect(verifyScript).toContain(command)
    }
  })

  test('verify waits for a green CI passed check before installing anything', () => {
    const steps = verify?.steps ?? []
    const gateIndex = steps.findIndex(
      (step) => step.name === 'Require green CI on the tagged commit',
    )
    const installIndex = steps.findIndex((step) => step.run === 'bun ci')
    expect(gateIndex).toBeGreaterThan(-1)
    expect(gateIndex).toBeLessThan(installIndex)
    const gate = steps[gateIndex]
    expect(gate?.run).toContain('"CI passed"')
    expect(gate?.run).not.toContain('${{')
    expect(gate?.env).toEqual({ GH_TOKEN: '${{ github.token }}' })
  })

  test('publish needs verify and runs no dependency install', () => {
    expect(publish?.needs).toBe('verify')
    const withoutPinnedNpm = publishScript.replaceAll(
      /npm install -g npm@\d+\.\d+\.\d+/g,
      '',
    )
    expect(withoutPinnedNpm).not.toMatch(
      /\b(bun (ci|install|add|x)|bunx|npm (ci|install|i)|npx|pnpm|yarn)\b/,
    )
    const usesSetupBun = publish?.steps?.some((step) =>
      step.uses?.includes('setup-bun'),
    )
    expect(usesSetupBun).toBe(false)
  })

  test('publish passes the tarball to npm as an explicit relative path', () => {
    expect(publishScript).toMatch(
      /tarball=\$\(ls \.\/release-artifact\/\*\.tgz\)/,
    )
  })

  test('publish pins npm to 11.5.1 or newer and never uses latest', () => {
    const match = /npm install -g npm@(\d+)\.(\d+)\.(\d+)/.exec(publishScript)
    expect(match).not.toBeNull()
    const [major = 0, minor = 0, patch = 0] = (match ?? []).slice(1).map(Number)
    const atLeast =
      major > 11 || (major === 11 && (minor > 5 || (minor === 5 && patch >= 1)))
    expect(atLeast).toBe(true)
    expect(JSON.stringify(workflow)).not.toContain('npm@latest')
  })

  test('verify gates on assets:verify-live after bun is installed', () => {
    const steps = verify?.steps ?? []
    const gateIndex = steps.findIndex((step) =>
      step.run?.includes('bun run assets:verify-live'),
    )
    const bunIndex = steps.findIndex((step) => step.uses?.includes('setup-bun'))
    const installIndex = steps.findIndex((step) => step.run === 'bun ci')
    expect(gateIndex).toBeGreaterThan(bunIndex)
    expect(gateIndex).toBeGreaterThan(installIndex)
    expect(verifyScript).not.toContain('%{http_code}')
  })

  test('publish derives the npm dist-tag from a prerelease version', () => {
    expect(publishScript).toContain('--tag "${dist_tag}"')
    expect(publishScript).toContain('dist_tag=latest')
    expect(publishScript).toContain('${version#*-}')
  })

  test('maps a numeric prerelease to the next dist-tag', () => {
    expect(publishScript).toContain('=~ ^[0-9]+$')
    expect(publishScript).toContain('dist_tag=next')
  })

  test('marks prerelease tags as prereleases that are never latest', () => {
    expect(publishScript).toContain('--prerelease --latest=false')
    expect(publishScript).toContain('"${GITHUB_REF_NAME}" == *-*')
  })

  test('verify checks the tag, main ancestry and non-empty notes', () => {
    expect(verifyScript).toContain('package.json')
    expect(verifyScript).toContain('merge-base --is-ancestor')
    expect(verifyScript).toContain('release-notes.md')
  })

  test('verify rejects a tag that is not annotated and signed before installing anything', () => {
    const steps = verify?.steps ?? []
    const gateIndex = steps.findIndex(
      (step) => step.name === 'Check the tag is annotated and signed',
    )
    const installIndex = steps.findIndex((step) => step.run === 'bun ci')
    expect(gateIndex).toBeGreaterThan(-1)
    expect(gateIndex).toBeLessThan(installIndex)
    const gate = steps[gateIndex]
    expect(gate?.env).toEqual({ GH_TOKEN: '${{ github.token }}' })
    expect(gate?.run).toContain('git/ref/tags/${GITHUB_REF_NAME}" --jq .object')
    expect(gate?.run).toContain('"${tag_type}" != "tag"')
    expect(gate?.run).toContain('git/tags/${tag_sha}" --jq .verification')
    expect(gate?.run).toContain('"${verified}" != "true"')
    expect(gate?.run?.match(/exit 1/g)).toHaveLength(2)
  })

  test('publish installs the Node version that verify copied from .node-version', () => {
    expect(verifyScript).toContain(
      'cp .node-version release-artifact/node-version',
    )
    const setupNode = publish?.steps?.find((step) =>
      step.uses?.startsWith('actions/setup-node@'),
    )
    expect(setupNode?.with?.['node-version-file']).toBe(
      'release-artifact/node-version',
    )
  })

  test('publish is idempotent for npm and the GitHub Release', () => {
    expect(publishScript).toMatch(/npm view [^\n]*version/)
    expect(publishScript).toContain('npm publish')
    expect(publishScript).toContain('gh release view')
    expect(publishScript).toContain('gh release create')
  })

  test('does not interpolate expressions into the scripts', () => {
    expect(verifyScript).not.toContain('${{')
    expect(publishScript).not.toContain('${{')
  })
})

describe('ci.yml eslint cache', () => {
  const cacheStep = collectSteps(readWorkflow('ci.yml')).find((step) =>
    step.with?.path?.toString().includes('.eslintcache'),
  )

  test('keys the cache on the local eslint rules too', () => {
    expect(String(cacheStep?.with?.key)).toContain('eslint-rules/**')
  })
})

describe('release.yml library workspace', () => {
  const verifySteps = readWorkflow('release.yml').jobs?.verify?.steps ?? []
  const verifyScript = verifySteps.map((step) => step.run ?? '').join('\n')

  test('checks the tag against the library package.json', () => {
    expect(verifyScript).toContain(
      'jq -r .version packages/animated-fluent-emojis/package.json',
    )
  })

  test('packs from the library directory with its prepack enabled', () => {
    expect(verifyScript).toContain(
      'cd packages/animated-fluent-emojis && bun pm pack',
    )
    expect(verifyScript).not.toContain('--ignore-scripts')
  })

  test('verifies the tarball holds dist, README, LICENSE and package.json', () => {
    for (const entry of [
      'package/package.json',
      'package/README.md',
      'package/LICENSE',
      'package/dist/',
    ]) {
      expect(verifyScript).toContain(entry)
    }
  })
})

describe('ci.yml turbo wiring', () => {
  const workflow = readWorkflow('ci.yml')
  const jobs = Object.entries(workflow.jobs ?? {})
  const turboRuns = collectSteps(workflow).filter((step) =>
    step.run?.includes('turbo run'),
  )

  test('every checkout that feeds turbo fetches full history', () => {
    for (const [name, job] of jobs) {
      if (!job.steps?.some((step) => step.run?.includes('turbo run'))) continue
      const checkout = job.steps.find((step) =>
        step.uses?.startsWith('actions/checkout@'),
      )
      expect(checkout?.with?.['fetch-depth'], name).toBe(0)
    }
  })

  test('every job that runs turbo caches .turbo', () => {
    for (const [name, job] of jobs) {
      if (!job.steps?.some((step) => step.run?.includes('turbo run'))) continue
      const cached = job.steps.some(
        (step) => step.with?.path?.toString() === '.turbo',
      )
      expect(cached, name).toBe(true)
    }
  })

  test('workspace runs are affected-only on pull requests and root tasks never are', () => {
    for (const step of turboRuns) {
      const isRootTask = /turbo run \S*:root\b/.test(step.run ?? '')
      expect(step.run?.includes('--affected'), step.run).toBe(!isRootTask)
    }
  })

  test('affected runs resolve the pull request base ref', () => {
    for (const step of turboRuns) {
      if (!step.run?.includes('--affected')) continue
      expect(step.env?.TURBO_SCM_BASE, step.run).toBe(
        'origin/${{ github.base_ref }}',
      )
    }
  })

  test('keeps the aggregate job name', () => {
    const source = readFileSync(
      new URL('../.github/workflows/ci.yml', import.meta.url),
      'utf8',
    )
    expect(source).toContain('name: CI passed')
  })
})

const ROUTED_RUNNER_EXPRESSION =
  "${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || vars.BLACKSMITH_RUNNER || 'ubuntu-latest' }}"

const ROUTED_JOBS: ReadonlySet<string> = new Set([
  'ci.yml:quality',
  'ci.yml:commitlint',
  'ci.yml:ci-passed',
  'lint-pr.yml:validate-title',
  'lint-docs.yml:check-links',
  'lint-workflows.yml:lint',
  'labels.yml:sync',
])

const MATRIX_OS_PATTERN = /^\$\{\{\s*matrix\.os\s*\}\}$/
const FORBIDDEN_RUNNER_PATTERN = /\bvps-|self-hosted/

interface JobRunner {
  readonly key: string
  readonly runsOn: unknown
  readonly source: string
}

function normalizeWhitespace(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim()
}

function describeRunner(runsOn: unknown): string {
  if (typeof runsOn === 'string') return normalizeWhitespace(runsOn)
  return runsOn === undefined ? 'nothing' : JSON.stringify(runsOn)
}

function collectJobRunners(): JobRunner[] {
  return listWorkflowFiles().flatMap((fileName) =>
    Object.entries(readWorkflow(fileName).jobs ?? {}).map(([jobName, job]) => ({
      key: `${fileName}:${jobName}`,
      runsOn: (job as { readonly 'runs-on'?: unknown })['runs-on'],
      source: JSON.stringify(job),
    })),
  )
}

function findRunnerViolation({
  key,
  runsOn,
  source,
}: JobRunner): string | undefined {
  const runner = describeRunner(runsOn)
  if (FORBIDDEN_RUNNER_PATTERN.test(runner)) {
    return `job "${key}" uses a forbidden runner label: ${runner}`
  }
  if (ROUTED_JOBS.has(key)) {
    return runner === ROUTED_RUNNER_EXPRESSION
      ? undefined
      : `routed job "${key}" must use the standard runner expression, got ${runner}`
  }
  if (source.includes('BLACKSMITH_RUNNER')) {
    return `job "${key}" is not routed and must not read vars.BLACKSMITH_RUNNER`
  }
  return runsOn === 'ubuntu-latest' || MATRIX_OS_PATTERN.test(runner)
    ? undefined
    : `job "${key}" must run on a literal ubuntu-latest or matrix.os, got ${runner}`
}

describe('runner routing (standard v1 R9)', () => {
  const runners = collectJobRunners()

  test('every routed job exists', () => {
    const keys = runners.map((runner) => runner.key)
    for (const routedJob of ROUTED_JOBS) {
      expect(keys, routedJob).toContain(routedJob)
    }
  })

  test.each(runners.map((runner) => [runner.key, runner] as const))(
    '%s runs on its expected runner',
    (_key, runner) => {
      expect(findRunnerViolation(runner)).toBeUndefined()
    },
  )
})

describe('site-quality.yml aggregate job', () => {
  const jobs = readWorkflow('site-quality.yml').jobs ?? {}
  const aggregate = jobs['site-quality']

  test('keeps the required check name', () => {
    expect(aggregate?.name).toBe('Smoke, accessibility and Lighthouse budget')
  })

  test('runs even when a job it needs failed or was skipped', () => {
    expect(aggregate?.if).toBe('always()')
  })

  test('needs every other job in the file', () => {
    const otherJobs = Object.keys(jobs).filter(
      (name) => name !== 'site-quality',
    )
    const needed = (aggregate?.needs as string[]).toSorted((first, second) =>
      first.localeCompare(second),
    )
    const expected = otherJobs.toSorted((first, second) =>
      first.localeCompare(second),
    )
    expect(needed).toEqual(expected)
  })
})

const LIGHTHOUSE_SCRIPT = fileURLToPath(
  new URL('../apps/site/scripts/lighthouse-budget.sh', import.meta.url),
)

function runLighthouseScript(
  environment: Record<string, string>,
): ReturnType<typeof spawnSync> {
  return spawnSync('bash', [LIGHTHOUSE_SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, ...environment, LIGHTHOUSE_LIST: '1' },
  })
}

function listLighthousePages(shard?: string): string[] {
  const result = runLighthouseScript(
    shard === undefined ? {} : { LIGHTHOUSE_SHARD: shard },
  )
  expect(result.status, String(result.stderr)).toBe(0)
  return String(result.stdout).split('\n').filter(Boolean)
}

interface ShardedJob {
  readonly strategy?: {
    readonly 'fail-fast'?: boolean
    readonly matrix?: { readonly shard?: readonly number[] }
  }
  readonly steps?: readonly WorkflowStep[]
}

function sortAlphabetically(values: readonly string[]): string[] {
  return values.toSorted((first, second) => first.localeCompare(second))
}

describe('site-quality.yml lighthouse shards', () => {
  const job: ShardedJob | undefined =
    readWorkflow('site-quality.yml').jobs?.lighthouse
  const shards = job?.strategy?.matrix?.shard ?? []
  const auditStep = job?.steps?.find((step) =>
    step.run?.includes('lighthouse-budget.sh'),
  )

  test('runs as a matrix of at least two shards that do not cancel each other', () => {
    expect(shards.length).toBeGreaterThanOrEqual(2)
    expect(shards).toEqual(shards.map((_, index) => index + 1))
    expect(job?.strategy?.['fail-fast']).toBe(false)
  })

  test('passes the shard selector and keeps five runs per page', () => {
    expect(auditStep?.env?.LIGHTHOUSE_SHARD).toBe(
      '${{ matrix.shard }}/${{ strategy.job-total }}',
    )
    expect(auditStep?.env?.LIGHTHOUSE_RUNS ?? '5').toBe('5')
    expect(auditStep?.run).not.toContain('${{')
  })

  test('uploads one failure report per shard', () => {
    const upload = job?.steps?.find((step) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    )
    expect(String(upload?.with?.name)).toContain('${{ matrix.shard }}')
  })

  test('audits every page in exactly one shard', () => {
    const allPages = listLighthousePages()
    const shardedPages = shards.flatMap((shard) => {
      const selector = `${String(shard)}/${String(shards.length)}`
      const pages = listLighthousePages(selector)
      expect(pages.length, selector).toBeGreaterThan(0)
      return pages
    })
    expect(allPages.length).toBeGreaterThan(0)
    expect(sortAlphabetically(shardedPages)).toEqual(
      sortAlphabetically(allPages),
    )
  })

  test.each(['0/2', '3/2', '1/0', 'one/two', '1'])(
    'rejects the malformed shard selector %s',
    (shard) => {
      expect(runLighthouseScript({ LIGHTHOUSE_SHARD: shard }).status).not.toBe(
        0,
      )
    },
  )
})

describe('ci.yml package job', () => {
  const steps = readWorkflow('ci.yml').jobs?.package?.steps ?? []
  const build = steps.find((step) => step.run?.includes('lint:package'))

  test('builds only the library, not the site', () => {
    expect(build?.run).toContain('--filter=animated-fluent-emojis')
  })
})

describe('ci.yml Playwright browser cache', () => {
  const steps = readWorkflow('ci.yml').jobs?.test?.steps ?? []
  const names = steps.map((step) => step.name)
  const versionIndex = steps.findIndex(
    (step) => step.id === 'playwright-version',
  )
  const cacheIndex = steps.findIndex(
    (step) => step.with?.path === '~/.cache/ms-playwright',
  )
  const installIndex = names.indexOf('Install Playwright browsers')

  test('keys the cache on the resolved Playwright version', () => {
    expect(steps[versionIndex]?.run).toContain('playwright --version')
    expect(steps[cacheIndex]?.uses).toMatch(/^actions\/cache@[0-9a-f]{40}$/)
    expect(String(steps[cacheIndex]?.with?.key)).toContain(
      '${{ steps.playwright-version.outputs.version }}',
    )
    expect(steps[cacheIndex]?.with?.['restore-keys']).toBeUndefined()
  })

  test('restores the cache before installing, and always installs system deps', () => {
    expect(versionIndex).toBeGreaterThan(-1)
    expect(cacheIndex).toBeGreaterThan(versionIndex)
    expect(installIndex).toBeGreaterThan(cacheIndex)
    expect(steps[installIndex]?.run).toContain('--with-deps')
    expect(steps[installIndex]?.if).toBeUndefined()
  })
})

describe('site-quality.yml paths filter', () => {
  const trigger = readWorkflow('site-quality.yml').on as {
    readonly pull_request?: { readonly paths?: readonly string[] }
  }

  test.each([
    'tsconfig.base.json',
    'bunfig.toml',
    'turbo.json',
    'package.json',
  ])('runs when only %s changes', (file) => {
    expect(trigger.pull_request?.paths).toContain(file)
  })
})

describe('renovate.json5 custom managers', () => {
  const config = readFileSync(
    new URL('../renovate.json5', import.meta.url),
    'utf8',
  )

  test('tracks the wrangler-action wranglerVersion pin', () => {
    expect(config).toContain('wranglerVersion: (?<currentValue>')
    expect(config).toContain("depNameTemplate: 'wrangler'")
  })
})
