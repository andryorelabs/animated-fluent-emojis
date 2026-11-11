declare const process: { env: { NODE_ENV?: string } };

/**
 * Tells whether the consumer's bundler left development checks enabled.
 * @returns True unless `process.env.NODE_ENV` is `production`; false where `process` does not exist.
 */
export function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}
