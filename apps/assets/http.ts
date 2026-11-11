/**
 * Fetch signature used by the asset scripts so tests can inject a fake.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 500;
const MAX_RETRY_AFTER_MS = 60_000;

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (header === null) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const dateMs = Date.parse(trimmed);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - Date.now());
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Per-attempt request timeout applied by `fetchOk`.
 */
const REQUEST_TIMEOUT_MS = 60_000;

async function fetchWithRetries(
  fetchImplementation: FetchLike,
  url: string,
  init: RequestInit | undefined,
  attempts: number,
  timeoutMs: number,
  acceptNotFound: boolean,
): Promise<Response | undefined> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let waitMs = BACKOFF_BASE_MS * 2 ** (attempt - 1);
    try {
      const response = await fetchImplementation(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) {
        const body = await response.arrayBuffer();
        return new Response(body.byteLength > 0 ? body : null, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
      if (acceptNotFound && response.status === 404) return undefined;
      lastError = new Error(`HTTP ${String(response.status)} for ${url}`);
      if (!isRetryableStatus(response.status)) break;
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      if (retryAfterMs !== undefined) waitMs = Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
    } catch (error: unknown) {
      lastError = error;
    }
    if (attempt < attempts) await delay(waitMs);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Fetches a URL and fails on any non-2xx status. Every attempt is aborted
 * after `timeoutMs` (unless the caller passes its own `signal`). Timeouts,
 * network errors and 408, 429 and 5xx responses are retried with exponential
 * backoff, honouring `Retry-After` (seconds or HTTP date) capped at 60
 * seconds. Any other 4xx fails immediately.
 * @param fetchImplementation The fetch function to use.
 * @param url The URL to request.
 * @param init Optional request options.
 * @param attempts How many times to try before giving up.
 * @param timeoutMs How long a single attempt may take.
 * @returns The successful response.
 */
export async function fetchOk(
  fetchImplementation: FetchLike,
  url: string,
  init?: RequestInit,
  attempts = MAX_ATTEMPTS,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const response = await fetchWithRetries(
    fetchImplementation,
    url,
    init,
    attempts,
    timeoutMs,
    false,
  );
  if (!response) throw new Error(`HTTP 404 for ${url}`);
  return response;
}

/**
 * Like {@link fetchOk}, but an HTTP 404 resolves to undefined instead of
 * failing, so callers can treat a missing file as an expected answer.
 * @param fetchImplementation The fetch function to use.
 * @param url The URL to request.
 * @param init Optional request options.
 * @param attempts How many times to try before giving up.
 * @param timeoutMs How long a single attempt may take.
 * @returns The successful response, or undefined on HTTP 404.
 */
export function fetchOkOrMissing(
  fetchImplementation: FetchLike,
  url: string,
  init?: RequestInit,
  attempts = MAX_ATTEMPTS,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response | undefined> {
  return fetchWithRetries(fetchImplementation, url, init, attempts, timeoutMs, true);
}

/**
 * Runs an async worker over items with a fixed concurrency limit.
 * @param items The items to process.
 * @param limit Maximum number of workers running at once.
 * @param worker Async function applied to each item.
 * @returns The results in the same order as the items.
 */
export async function mapWithConcurrency<Item, Result>(
  items: readonly Item[],
  limit: number,
  worker: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> {
  const results = Array.from<Result>({ length: items.length });
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index] as Item, index);
    }
  });
  await Promise.all(runners);
  return results;
}
