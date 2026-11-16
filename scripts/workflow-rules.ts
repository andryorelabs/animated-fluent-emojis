/**
 * A step as the workflow rules read it.
 */
export interface RuleStep {
  readonly name?: string;
  readonly if?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly with?: Record<string, unknown>;
}

/**
 * A job as the workflow rules read it.
 */
export interface RuleJob {
  readonly name?: string;
  readonly if?: string;
  readonly needs?: unknown;
  readonly "runs-on"?: unknown;
  readonly steps?: readonly RuleStep[];
}

/**
 * The subset of a parsed workflow document the rules inspect. The `readWorkflow`
 * output of `scripts/workflow-files.ts` satisfies it.
 */
export interface RuleWorkflow {
  readonly on?: unknown;
  readonly concurrency?: unknown;
  readonly jobs?: Record<string, RuleJob>;
}

/**
 * The only `runs-on` value a job may use (standard v2 F3, ADR 0028): Blacksmith when
 * `BLACKSMITH_RUNNER` is set, GitHub-hosted for fork pull requests and otherwise.
 */
export const ROUTED_RUNS_ON =
  "${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || vars.BLACKSMITH_RUNNER || 'ubuntu-latest' }}";

function normalizeWhitespace(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function jobEntries(workflow: RuleWorkflow): [string, RuleJob][] {
  return Object.entries(workflow.jobs ?? {});
}

const REF_PIN_PATTERN = /github\.ref\s*==\s*'([^']+)'/g;
const DEPLOY_ACTION_PREFIX = "cloudflare/wrangler-action@";
const DEPLOY_SCRIPT = "deploy-coolify.sh";

function neededJobIds(job: RuleJob): string[] {
  const { needs } = job;
  if (typeof needs === "string") return [needs];
  return Array.isArray(needs) ? needs.map(String) : [];
}

function isPinnedAwayFrom(condition: string, ref: string): boolean {
  if (condition.includes("||")) return false;
  const pinnedReferences = Array.from(condition.matchAll(REF_PIN_PATTERN), (match) => match[1]);
  return pinnedReferences.some((pinnedReference) => pinnedReference !== ref);
}

function runsOnlyOnFailure(condition: string): boolean {
  return /(?<!!)failure\(\)/.test(condition) && !condition.includes("always()");
}

function ignoresSkippedNeeds(condition: string): boolean {
  return condition.includes("always()") || condition.includes("!failure()");
}

/**
 * Lists the jobs that run when the workflow is started on `ref` and every job that runs
 * succeeds. A job does not run when its `if` pins `github.ref` to another ref (an `if`
 * with `||` is never read as a pin), when its `if` runs it only on failure, or when a
 * job it needs does not run and its `if` does not use `always()` or `!failure()`.
 * @param workflow The parsed workflow.
 * @param ref The full ref the run starts on, such as `refs/heads/main`.
 * @returns The ids of the jobs that run, in file order.
 */
export function jobsRunningOnRef(workflow: RuleWorkflow, ref: string): string[] {
  const jobs = workflow.jobs ?? {};
  const decided = new Map<string, boolean>();
  const runs = (id: string): boolean => {
    const known = decided.get(id);
    if (known !== undefined) return known;
    const job = jobs[id];
    const condition = job?.if ?? "";
    const result =
      job !== undefined &&
      !isPinnedAwayFrom(condition, ref) &&
      !runsOnlyOnFailure(condition) &&
      (ignoresSkippedNeeds(condition) || neededJobIds(job).every((needed) => runs(needed)));
    decided.set(id, result);
    return result;
  };
  return Object.keys(jobs).filter((id) => runs(id));
}

function deploys(job: RuleJob): boolean {
  return (job.steps ?? []).some(
    (step) =>
      step.uses?.startsWith(DEPLOY_ACTION_PREFIX) === true ||
      step.run?.includes(DEPLOY_SCRIPT) === true,
  );
}

/**
 * Lists the jobs that deploy (through Wrangler or the Coolify script) and still run when
 * the workflow starts on `ref`. On any ref but `refs/heads/main` the list must be empty.
 * @param workflow The parsed workflow.
 * @param ref The full ref the run starts on.
 * @returns The ids of the deploy jobs that run, in file order.
 */
export function deployJobsRunningOnRef(workflow: RuleWorkflow, ref: string): string[] {
  const jobs = workflow.jobs ?? {};
  return jobsRunningOnRef(workflow, ref).filter((id) => {
    const job = jobs[id];
    return job !== undefined && deploys(job);
  });
}

/**
 * Lists the jobs whose `runs-on` is not {@link ROUTED_RUNS_ON}.
 * @param workflow The parsed workflow.
 * @returns The offending job ids, in file order.
 */
export function jobsOffRunnerExpression(workflow: RuleWorkflow): string[] {
  return jobEntries(workflow)
    .filter(([, job]) => {
      const runner = job["runs-on"];
      return typeof runner !== "string" || normalizeWhitespace(runner) !== ROUTED_RUNS_ON;
    })
    .map(([id]) => id);
}

const PRIVATE_REPOSITORY_SKIP = "!github.event.repository.private";
const CODEQL_INIT_PREFIX = "github/codeql-action/init@";
const SARIF_UPLOAD_PREFIX = "github/codeql-action/upload-sarif@";
const BUILD_COMMAND = "bun run build";
const CHANGELOG_FILE = "CHANGELOG.md";

/**
 * Lists the jobs that would run on a private repository, where code scanning needs
 * GitHub Advanced Security: their `if` lacks `!github.event.repository.private`.
 * @param workflow The parsed workflow.
 * @returns The offending job ids, in file order.
 */
export function jobsRunningOnPrivateRepositories(workflow: RuleWorkflow): string[] {
  return jobEntries(workflow)
    .filter(([, job]) => !(job.if ?? "").includes(PRIVATE_REPOSITORY_SKIP))
    .map(([id]) => id);
}

/**
 * Lists one job id per CodeQL `init` step that does not set `build-mode: none`.
 * @param workflow The parsed workflow.
 * @returns The ids of the jobs holding each offending step.
 */
export function codeqlInitsWithoutBuildModeNone(workflow: RuleWorkflow): string[] {
  return jobEntries(workflow).flatMap(([id, job]) =>
    (job.steps ?? [])
      .filter((step) => step.uses?.startsWith(CODEQL_INIT_PREFIX) === true)
      .filter((step) => step.with?.["build-mode"] !== "none")
      .map(() => id),
  );
}

/**
 * Lists the event names under a workflow's `on:`, written as a name, a list or a mapping.
 * @param workflow The parsed workflow.
 * @returns The event names.
 */
export function triggerNames(workflow: RuleWorkflow): string[] {
  const trigger = workflow.on;
  if (typeof trigger === "string") return [trigger];
  if (Array.isArray(trigger)) return trigger.map(String);
  return trigger !== null && typeof trigger === "object" ? Object.keys(trigger) : [];
}

/**
 * Reads the `push` trigger's branch filter.
 * @param workflow The parsed workflow.
 * @returns The branch names, or an empty list when `push` has no branch filter.
 */
export function pushBranches(workflow: RuleWorkflow): string[] {
  const trigger = workflow.on;
  if (trigger === null || typeof trigger !== "object" || Array.isArray(trigger)) return [];
  const push = (trigger as { readonly push?: { readonly branches?: unknown } }).push;
  const branches = push?.branches;
  return Array.isArray(branches) ? branches.map(String) : [];
}

/**
 * Tells whether any job uploads a SARIF file to code scanning.
 * @param workflow The parsed workflow.
 * @returns Whether a `github/codeql-action/upload-sarif` step exists.
 */
export function uploadsSarif(workflow: RuleWorkflow): boolean {
  return jobEntries(workflow).some(([, job]) =>
    (job.steps ?? []).some((step) => step.uses?.startsWith(SARIF_UPLOAD_PREFIX) === true),
  );
}

/**
 * Reads the workflow's concurrency group, from a mapping or the string shorthand.
 * @param workflow The parsed workflow.
 * @returns The group, or `undefined` when there is none or it is blank.
 */
export function concurrencyGroup(workflow: RuleWorkflow): string | undefined {
  const { concurrency } = workflow;
  const group =
    concurrency !== null && typeof concurrency === "object"
      ? (concurrency as { readonly group?: unknown }).group
      : concurrency;
  return typeof group === "string" && group.trim() !== "" ? group : undefined;
}

/**
 * Tells whether a job reads `CHANGELOG.md` in a step before the one that runs
 * `bun run build`, so a release without notes fails before the slow build.
 * @param job The job to inspect, usually the release `verify` job.
 * @returns Whether both steps exist and the CHANGELOG check comes first.
 */
export function checksChangelogBeforeBuild(job: RuleJob): boolean {
  const steps = job.steps ?? [];
  const changelogIndex = steps.findIndex((step) => step.run?.includes(CHANGELOG_FILE) === true);
  const buildIndex = steps.findIndex((step) => step.run?.trim() === BUILD_COMMAND);
  return changelogIndex !== -1 && buildIndex !== -1 && changelogIndex < buildIndex;
}
