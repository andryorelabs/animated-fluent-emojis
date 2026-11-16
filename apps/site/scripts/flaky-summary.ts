import { appendFileSync, existsSync, readFileSync } from "node:fs";

interface ReportResult {
  readonly status: string;
}

interface ReportTest {
  readonly results: readonly ReportResult[];
}

interface ReportSpec {
  readonly title: string;
  readonly file: string;
  readonly tests: readonly ReportTest[];
}

interface ReportSuite {
  readonly specs?: readonly ReportSpec[];
  readonly suites?: readonly ReportSuite[];
}

/**
 * The slice of Playwright's JSON reporter output this script reads.
 */
export interface PlaywrightReport {
  readonly suites?: readonly ReportSuite[];
}

/**
 * Where {@link writeFlakySummary} reads the report and writes the summary.
 */
export interface FlakySummaryPaths {
  /** The Playwright JSON report. */
  readonly reportPath: string;
  /** The file to append to, usually `$GITHUB_STEP_SUMMARY`; omitted, nothing is written. */
  readonly summaryPath?: string | undefined;
}

const SUMMARY_HEADING = "### Flaky e2e tests";

function collectSpecs(suite: ReportSuite): ReportSpec[] {
  return [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap((child) => collectSpecs(child))];
}

function passedOnlyOnRetry({ results }: ReportTest): boolean {
  return (
    results.length > 1 &&
    results.at(-1)?.status === "passed" &&
    results.some(({ status }) => status !== "passed")
  );
}

/**
 * Lists the tests that failed at least once and then passed on a retry.
 * @param report A parsed Playwright JSON report.
 * @returns `file: title` for each flaky test, in report order.
 */
export function findFlakyTests(report: PlaywrightReport): string[] {
  return (report.suites ?? [])
    .flatMap((suite) => collectSpecs(suite))
    .filter((spec) => spec.tests.some((test) => passedOnlyOnRetry(test)))
    .map((spec) => `${spec.file}: ${spec.title}`);
}

/**
 * Renders the Markdown section shown in the job summary.
 * @param flaky The flaky test names.
 * @returns The Markdown section.
 */
export function renderSummary(flaky: readonly string[]): string {
  if (flaky.length === 0) return `${SUMMARY_HEADING}\n\nNone.\n`;
  const items = flaky.map((name) => `- ${name}`).join("\n");
  return `${SUMMARY_HEADING}\n\n${items}\n`;
}

function summarizeReport(reportPath: string): string {
  if (!existsSync(reportPath)) {
    return `${SUMMARY_HEADING}\n\nNo Playwright JSON report at \`${reportPath}\`.\n`;
  }
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as PlaywrightReport;
  return renderSummary(findFlakyTests(report));
}

/**
 * Summarizes the tests that passed only on a retry and appends the summary to
 * `summaryPath` when one is given. A missing report is noted, not thrown.
 * @param paths The report to read and the summary file to append to.
 * @param paths.reportPath The Playwright JSON report.
 * @param paths.summaryPath The file to append to; omitted, nothing is written.
 * @returns The Markdown summary.
 */
export function writeFlakySummary({ reportPath, summaryPath }: FlakySummaryPaths): string {
  const summary = summarizeReport(reportPath);
  if (summaryPath !== undefined) appendFileSync(summaryPath, summary);
  return summary;
}

if (import.meta.main) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const summary = writeFlakySummary({
    reportPath: process.argv[2] ?? "test-results/report.json",
    summaryPath,
  });
  if (summaryPath === undefined) console.log(summary);
}
