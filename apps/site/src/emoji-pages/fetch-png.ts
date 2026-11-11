const FETCH_ATTEMPTS = 4;

/**
 * Downloads an emoji PNG, retrying network failures and server errors so a
 * transient connection reset does not fail a build of thousands of images.
 * @param url - Absolute URL of the emoji PNG on the files site.
 * @returns The raw PNG bytes.
 */
export async function fetchPng(url: string): Promise<ArrayBuffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.arrayBuffer();
      lastError = new Error(`${url} answered ${String(response.status)}`);
      if (response.status < 500) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw lastError;
}
