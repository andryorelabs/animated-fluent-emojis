import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * The repository settings this repo keeps as code: the settings in the shape
 * of `.github/repo-settings.json` (the `repository`, `security`, `actions` and
 * `code_scanning` groups), and the rulesets, keyed by ruleset name.
 */
export interface RepositorySettings {
  readonly settings: JsonObject;
  readonly rulesets: Readonly<Record<string, JsonObject>>;
}

/**
 * One value that differs between the files and GitHub. `undefined` on a side
 * means that side has no such value.
 */
export interface SettingDifference {
  readonly path: string;
  readonly expected: JsonValue | undefined;
  readonly live: JsonValue | undefined;
}

/**
 * Runs `gh` with the given arguments and resolves with its standard output.
 * It rejects when `gh` exits non-zero, with `gh`'s standard error in the
 * error's `stderr` or `message`.
 */
export type GhRunner = (commandArguments: string[]) => Promise<string>;

export const REPOSITORY = "andryorelabs/animated-fluent-emojis";

const RULESETS_DIRECTORY = path.resolve(import.meta.dirname, "../../.github/rulesets");
const SETTINGS_FILE = path.resolve(import.meta.dirname, "../../.github/repo-settings.json");

const SETTINGS_GROUPS = ["repository", "security", "actions", "code_scanning"] as const;

const REPOSITORY_FIELDS = [
  "description",
  "homepage",
  "topics",
  "default_branch",
  "has_wiki",
  "has_projects",
  "has_discussions",
  "allow_squash_merge",
  "allow_merge_commit",
  "allow_rebase_merge",
  "allow_auto_merge",
  "allow_update_branch",
  "delete_branch_on_merge",
  "squash_merge_commit_title",
  "squash_merge_commit_message",
  "merge_commit_title",
  "merge_commit_message",
] as const;

const RULESET_FIELDS = [
  "name",
  "target",
  "enforcement",
  "conditions",
  "bypass_actors",
  "rules",
] as const;

const ELEMENT_IDENTITY_KEYS = ["type", "context"] as const;

const NOT_FOUND = "HTTP 404";

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonArray(value: JsonValue | undefined): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function parseJsonObject(text: string, source: string): JsonObject {
  const parsed = JSON.parse(text) as JsonValue;
  if (!isJsonObject(parsed)) {
    throw new Error(`repo-settings: ${source} is not a JSON object.`);
  }
  return parsed;
}

function identityOf(element: JsonValue): string | undefined {
  if (!isJsonObject(element)) return undefined;
  for (const key of ELEMENT_IDENTITY_KEYS) {
    const identity = element[key];
    if (typeof identity === "string") return identity;
  }
  return undefined;
}

function indexByIdentity(elements: readonly JsonValue[]): Map<string, JsonValue> | undefined {
  const index = new Map<string, JsonValue>();
  for (const element of elements) {
    const identity = identityOf(element);
    if (identity === undefined) return undefined;
    index.set(identity, element);
  }
  return index;
}

function sortedSerialization(elements: readonly JsonValue[]): string {
  return JSON.stringify(
    elements
      .map((element) => JSON.stringify(element))
      .toSorted((first, second) => first.localeCompare(second)),
  );
}

function diffArrays(
  valuePath: string,
  expected: readonly JsonValue[],
  live: readonly JsonValue[],
): SettingDifference[] {
  const expectedIndex = indexByIdentity(expected);
  const liveIndex = indexByIdentity(live);
  if (expectedIndex === undefined || liveIndex === undefined) {
    return sortedSerialization(expected) === sortedSerialization(live)
      ? []
      : [{ path: valuePath, expected, live }];
  }
  const differences: SettingDifference[] = [];
  for (const [identity, element] of expectedIndex) {
    differences.push(...diffValues(`${valuePath}[${identity}]`, element, liveIndex.get(identity)));
  }
  for (const [identity, element] of liveIndex) {
    if (expectedIndex.has(identity)) continue;
    differences.push({
      path: `${valuePath}[${identity}]`,
      expected: undefined,
      live: element,
    });
  }
  return differences;
}

function diffValues(
  valuePath: string,
  expected: JsonValue,
  live: JsonValue | undefined,
): SettingDifference[] {
  if (isJsonObject(expected) && isJsonObject(live)) {
    return Object.entries(expected).flatMap(([key, value]) =>
      diffValues(`${valuePath}.${key}`, value, live[key]),
    );
  }
  if (isJsonArray(expected) && isJsonArray(live)) {
    return diffArrays(valuePath, expected, live);
  }
  return expected === live ? [] : [{ path: valuePath, expected, live }];
}

/**
 * Lists every value that differs between the expected settings and the live
 * ones. Only the keys the expected side names are compared, so the defaults
 * GitHub adds to a response are not drift. A list of plain values, such as the
 * topics, is compared without regard to order. A ruleset, a rule or a required
 * check that exists only on GitHub is drift.
 * @param expected The settings held in the repository files.
 * @param live The settings read from GitHub.
 * @returns One entry per differing value, empty when there is no drift.
 */
export function diffSettings(
  expected: RepositorySettings,
  live: RepositorySettings,
): SettingDifference[] {
  const differences = Object.entries(expected.settings).flatMap(([key, value]) =>
    diffValues(`settings.${key}`, value, live.settings[key]),
  );
  for (const [name, ruleset] of Object.entries(expected.rulesets)) {
    differences.push(...diffValues(`rulesets.${name}`, ruleset, live.rulesets[name]));
  }
  for (const [name, ruleset] of Object.entries(live.rulesets)) {
    if (Object.hasOwn(expected.rulesets, name)) continue;
    differences.push({
      path: `rulesets.${name}`,
      expected: undefined,
      live: ruleset,
    });
  }
  return differences;
}

function definedEntries(entries: Record<string, JsonValue | undefined>): JsonObject {
  const picked: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) picked[key] = value;
  }
  return picked;
}

function pick(source: JsonObject, keys: readonly string[]): JsonObject {
  return definedEntries(Object.fromEntries(keys.map((key) => [key, source[key]])));
}

function getEndpoint(endpoint: string): string[] {
  return ["api", "--method", "GET", `repos/${REPOSITORY}${endpoint}`];
}

async function readObject(run: GhRunner, endpoint: string, source: string): Promise<JsonObject> {
  return parseJsonObject(await run(getEndpoint(endpoint)), source);
}

function featureEnabled(repository: JsonObject, feature: string): boolean | undefined {
  const analysis = repository.security_and_analysis;
  const entry = isJsonObject(analysis) ? analysis[feature] : undefined;
  const status = isJsonObject(entry) ? entry.status : undefined;
  if (status === "enabled") return true;
  return status === "disabled" ? false : undefined;
}

function isNotFound(error: unknown): boolean {
  const { message, stderr } = (error ?? {}) as {
    readonly message?: unknown;
    readonly stderr?: unknown;
  };
  return [message, stderr].some((text) => typeof text === "string" && text.includes(NOT_FOUND));
}

async function readDependabotAlerts(run: GhRunner): Promise<boolean> {
  try {
    await run(getEndpoint("/vulnerability-alerts"));
    return true;
  } catch (error: unknown) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

async function readSecurity(run: GhRunner, repository: JsonObject): Promise<JsonObject> {
  const dependabotAlerts = await readDependabotAlerts(run);
  const reporting = await readObject(
    run,
    "/private-vulnerability-reporting",
    "the private vulnerability reporting response",
  );
  return definedEntries({
    secret_scanning: featureEnabled(repository, "secret_scanning"),
    secret_scanning_push_protection: featureEnabled(repository, "secret_scanning_push_protection"),
    dependabot_alerts: dependabotAlerts,
    dependabot_security_updates: featureEnabled(repository, "dependabot_security_updates"),
    private_vulnerability_reporting: reporting.enabled,
  });
}

async function readActions(run: GhRunner): Promise<JsonObject> {
  const workflow = await readObject(
    run,
    "/actions/permissions/workflow",
    "the Actions workflow permissions response",
  );
  const forkApproval = await readObject(
    run,
    "/actions/permissions/fork-pr-contributor-approval",
    "the fork pull request approval response",
  );
  return definedEntries({
    default_workflow_permissions: workflow.default_workflow_permissions,
    can_approve_pull_request_reviews: workflow.can_approve_pull_request_reviews,
    fork_pr_contributor_approval: forkApproval.approval_policy,
  });
}

async function readCodeScanning(run: GhRunner): Promise<JsonObject> {
  const defaultSetup = await readObject(
    run,
    "/code-scanning/default-setup",
    "the CodeQL default setup response",
  );
  return definedEntries({ default_setup: defaultSetup.state });
}

async function readLiveRulesets(run: GhRunner): Promise<Record<string, JsonObject>> {
  const listed = JSON.parse(await run(getEndpoint("/rulesets"))) as JsonValue;
  if (!isJsonArray(listed)) {
    throw new Error("repo-settings: the rulesets response is not a list.");
  }
  const rulesets: Record<string, JsonObject> = {};
  for (const entry of listed) {
    const id = isJsonObject(entry) ? entry.id : undefined;
    if (typeof id !== "number") {
      throw new TypeError("repo-settings: a listed ruleset has no numeric id.");
    }
    const ruleset = await readObject(run, `/rulesets/${String(id)}`, `ruleset ${String(id)}`);
    const name = ruleset.name;
    if (typeof name !== "string") {
      throw new TypeError(`repo-settings: ruleset ${String(id)} has no name.`);
    }
    rulesets[name] = pick(ruleset, RULESET_FIELDS);
  }
  return rulesets;
}

/**
 * Reads the live repository settings and rulesets from GitHub, in the shape of
 * `.github/repo-settings.json`. Every call is a `GET`, so nothing is changed.
 * Dependabot alerts are off when their endpoint answers 404; any other failure
 * of a call rejects.
 * @param run Runs `gh` with the given arguments and resolves with its output.
 * @returns The live values of the settings this repo tracks, and its rulesets.
 */
export async function readLiveSettings(run: GhRunner): Promise<RepositorySettings> {
  const repository = await readObject(run, "", "the repository response");
  const settings: JsonObject = {
    repository: pick(repository, REPOSITORY_FIELDS),
    security: await readSecurity(run, repository),
    actions: await readActions(run),
    code_scanning: await readCodeScanning(run),
  };
  return { settings, rulesets: await readLiveRulesets(run) };
}

function readSettingsFile(settingsFile: string): JsonObject {
  const source = path.basename(settingsFile);
  const settings = parseJsonObject(readFileSync(settingsFile, "utf8"), source);
  for (const group of SETTINGS_GROUPS) {
    if (!isJsonObject(settings[group])) {
      throw new TypeError(`repo-settings: ${source} has no "${group}" object.`);
    }
  }
  return settings;
}

/**
 * Reads the expected settings from the repository: `.github/repo-settings.json`
 * and every ruleset file under `.github/rulesets`.
 * @param rulesetsDirectory The directory that holds the ruleset JSON files.
 * @param settingsFile The settings file, with the `repository`, `security`, `actions` and `code_scanning` groups.
 * @returns The expected settings, with the rulesets keyed by their `name`.
 */
export function readExpectedSettings(
  rulesetsDirectory: string = RULESETS_DIRECTORY,
  settingsFile: string = SETTINGS_FILE,
): RepositorySettings {
  const rulesets: Record<string, JsonObject> = {};
  const fileNames = readdirSync(rulesetsDirectory)
    .filter((fileName) => fileName.endsWith(".json"))
    .toSorted((first, second) => first.localeCompare(second));
  for (const fileName of fileNames) {
    const ruleset = parseJsonObject(
      readFileSync(path.join(rulesetsDirectory, fileName), "utf8"),
      fileName,
    );
    const name = ruleset.name;
    if (typeof name !== "string") {
      throw new TypeError(`repo-settings: ${fileName} has no name.`);
    }
    rulesets[name] = ruleset;
  }
  return { settings: readSettingsFile(settingsFile), rulesets };
}
