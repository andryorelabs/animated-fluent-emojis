import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | JsonObject

export interface JsonObject {
  readonly [key: string]: JsonValue
}

/**
 * The repository settings this repo keeps as code: the flat settings, keyed by
 * their dotted path in the GitHub REST responses, and the rulesets, keyed by
 * ruleset name.
 */
export interface RepositorySettings {
  readonly settings: JsonObject
  readonly rulesets: Readonly<Record<string, JsonObject>>
}

/**
 * One value that differs between the files and GitHub. `undefined` on a side
 * means that side has no such value.
 */
export interface SettingDifference {
  readonly path: string
  readonly expected: JsonValue | undefined
  readonly live: JsonValue | undefined
}

/** Runs `gh` with the given arguments and resolves with its standard output. */
export type GhRunner = (commandArguments: string[]) => Promise<string>

export const REPOSITORY = 'andryorelabs/animated-fluent-emojis'

/**
 * The expected repository settings, keyed by their dotted path in the GitHub
 * REST responses. `docs/brand/apply-spec.md` lists the same values with the
 * commands that apply them.
 */
export const EXPECTED_REPOSITORY_SETTINGS: JsonObject = {
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
  homepage: 'https://animated-fluent-emojis.andryore.dev',
  'security_and_analysis.secret_scanning.status': 'enabled',
  'security_and_analysis.secret_scanning_push_protection.status': 'enabled',
  'security_and_analysis.dependabot_security_updates.status': 'enabled',
  'private_vulnerability_reporting.enabled': true,
}

const RULESETS_DIRECTORY = path.resolve(
  import.meta.dirname,
  '../../.github/rulesets',
)

const RULESET_FIELDS = [
  'name',
  'target',
  'enforcement',
  'conditions',
  'bypass_actors',
  'rules',
] as const

const ELEMENT_IDENTITY_KEYS = ['type', 'context'] as const

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonArray(
  value: JsonValue | undefined,
): value is readonly JsonValue[] {
  return Array.isArray(value)
}

function parseJsonObject(text: string, source: string): JsonObject {
  const parsed = JSON.parse(text) as JsonValue
  if (!isJsonObject(parsed)) {
    throw new Error(`repo-settings: ${source} is not a JSON object.`)
  }
  return parsed
}

function identityOf(element: JsonValue): string | undefined {
  if (!isJsonObject(element)) return undefined
  for (const key of ELEMENT_IDENTITY_KEYS) {
    const identity = element[key]
    if (typeof identity === 'string') return identity
  }
  return undefined
}

function indexByIdentity(
  elements: readonly JsonValue[],
): Map<string, JsonValue> | undefined {
  const index = new Map<string, JsonValue>()
  for (const element of elements) {
    const identity = identityOf(element)
    if (identity === undefined) return undefined
    index.set(identity, element)
  }
  return index
}

function sortedSerialization(elements: readonly JsonValue[]): string {
  return JSON.stringify(
    elements
      .map((element) => JSON.stringify(element))
      .toSorted((first, second) => first.localeCompare(second)),
  )
}

function diffArrays(
  valuePath: string,
  expected: readonly JsonValue[],
  live: readonly JsonValue[],
): SettingDifference[] {
  const expectedIndex = indexByIdentity(expected)
  const liveIndex = indexByIdentity(live)
  if (expectedIndex === undefined || liveIndex === undefined) {
    return sortedSerialization(expected) === sortedSerialization(live)
      ? []
      : [{ path: valuePath, expected, live }]
  }
  const differences: SettingDifference[] = []
  for (const [identity, element] of expectedIndex) {
    differences.push(
      ...diffValues(
        `${valuePath}[${identity}]`,
        element,
        liveIndex.get(identity),
      ),
    )
  }
  for (const [identity, element] of liveIndex) {
    if (expectedIndex.has(identity)) continue
    differences.push({
      path: `${valuePath}[${identity}]`,
      expected: undefined,
      live: element,
    })
  }
  return differences
}

function diffValues(
  valuePath: string,
  expected: JsonValue,
  live: JsonValue | undefined,
): SettingDifference[] {
  if (isJsonObject(expected) && isJsonObject(live)) {
    return Object.entries(expected).flatMap(([key, value]) =>
      diffValues(`${valuePath}.${key}`, value, live[key]),
    )
  }
  if (isJsonArray(expected) && isJsonArray(live)) {
    return diffArrays(valuePath, expected, live)
  }
  return expected === live ? [] : [{ path: valuePath, expected, live }]
}

/**
 * Lists every value that differs between the expected settings and the live
 * ones. Only the keys the expected side names are compared, so the defaults
 * GitHub adds to a response are not drift. A ruleset, a rule or a required
 * check that exists only on GitHub is drift.
 * @param expected The settings held in the repository files.
 * @param live The settings read from GitHub.
 * @returns One entry per differing value, empty when there is no drift.
 */
export function diffSettings(
  expected: RepositorySettings,
  live: RepositorySettings,
): SettingDifference[] {
  const differences = Object.entries(expected.settings).flatMap(
    ([key, value]) => diffValues(`settings.${key}`, value, live.settings[key]),
  )
  for (const [name, ruleset] of Object.entries(expected.rulesets)) {
    differences.push(
      ...diffValues(`rulesets.${name}`, ruleset, live.rulesets[name]),
    )
  }
  for (const [name, ruleset] of Object.entries(live.rulesets)) {
    if (Object.hasOwn(expected.rulesets, name)) continue
    differences.push({
      path: `rulesets.${name}`,
      expected: undefined,
      live: ruleset,
    })
  }
  return differences
}

function lookUp(source: JsonObject, dottedPath: string): JsonValue | undefined {
  let current: JsonValue | undefined = source
  for (const segment of dottedPath.split('.')) {
    if (!isJsonObject(current)) return undefined
    current = current[segment]
  }
  return current
}

function pickDefined(
  source: JsonObject,
  keys: readonly string[],
  read: (source: JsonObject, key: string) => JsonValue | undefined,
): JsonObject {
  const picked: Record<string, JsonValue> = {}
  for (const key of keys) {
    const value = read(source, key)
    if (value !== undefined) picked[key] = value
  }
  return picked
}

function getEndpoint(endpoint: string): string[] {
  return ['api', '--method', 'GET', `repos/${REPOSITORY}${endpoint}`]
}

async function readLiveRulesets(
  run: GhRunner,
): Promise<Record<string, JsonObject>> {
  const listed = JSON.parse(await run(getEndpoint('/rulesets'))) as JsonValue
  if (!isJsonArray(listed)) {
    throw new Error('repo-settings: the rulesets response is not a list.')
  }
  const rulesets: Record<string, JsonObject> = {}
  for (const entry of listed) {
    const id = isJsonObject(entry) ? entry.id : undefined
    if (typeof id !== 'number') {
      throw new TypeError('repo-settings: a listed ruleset has no numeric id.')
    }
    const response = await run(getEndpoint(`/rulesets/${String(id)}`))
    const ruleset = parseJsonObject(response, `ruleset ${String(id)}`)
    const name = ruleset.name
    if (typeof name !== 'string') {
      throw new TypeError(`repo-settings: ruleset ${String(id)} has no name.`)
    }
    rulesets[name] = pickDefined(
      ruleset,
      RULESET_FIELDS,
      (source, key) => source[key],
    )
  }
  return rulesets
}

/**
 * Reads the live repository settings and rulesets from GitHub. Every call is
 * a `GET`, so nothing is changed.
 * @param run Runs `gh` with the given arguments and resolves with its output.
 * @returns The live values of the settings this repo tracks, and its rulesets.
 */
export async function readLiveSettings(
  run: GhRunner,
): Promise<RepositorySettings> {
  const repository = parseJsonObject(
    await run(getEndpoint('')),
    'the repository response',
  )
  const vulnerabilityReporting = parseJsonObject(
    await run(getEndpoint('/private-vulnerability-reporting')),
    'the private vulnerability reporting response',
  )
  const settings = pickDefined(
    { ...repository, private_vulnerability_reporting: vulnerabilityReporting },
    Object.keys(EXPECTED_REPOSITORY_SETTINGS),
    lookUp,
  )
  return { settings, rulesets: await readLiveRulesets(run) }
}

/**
 * Reads the expected settings from the repository: the settings list above
 * and every ruleset file under `.github/rulesets`.
 * @param rulesetsDirectory The directory that holds the ruleset JSON files.
 * @returns The expected settings, with the rulesets keyed by their `name`.
 */
export function readExpectedSettings(
  rulesetsDirectory: string = RULESETS_DIRECTORY,
): RepositorySettings {
  const rulesets: Record<string, JsonObject> = {}
  const fileNames = readdirSync(rulesetsDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .toSorted((first, second) => first.localeCompare(second))
  for (const fileName of fileNames) {
    const ruleset = parseJsonObject(
      readFileSync(path.join(rulesetsDirectory, fileName), 'utf8'),
      fileName,
    )
    const name = ruleset.name
    if (typeof name !== 'string') {
      throw new TypeError(`repo-settings: ${fileName} has no name.`)
    }
    rulesets[name] = ruleset
  }
  return { settings: EXPECTED_REPOSITORY_SETTINGS, rulesets }
}
