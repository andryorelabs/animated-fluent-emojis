import { SITE_ORIGIN } from "../i18n/locales";
import { REPOSITORY_URL } from "../site-links";

const VALIDITY_DAYS = 180;

/**
 * The `/.well-known/security.txt` body (RFC 9116). The contact and policy
 * mirror `.github/SECURITY.md`.
 * @param now - The build time; `Expires` is set 180 days after it.
 * @returns The file contents.
 */
export function buildSecurityTxt(now: Date = new Date()): string {
  const expires = new Date(now.getTime() + VALIDITY_DAYS * 86_400_000);
  return [
    `Contact: ${REPOSITORY_URL}/security/advisories/new`,
    `Expires: ${expires.toISOString()}`,
    `Policy: ${REPOSITORY_URL}/blob/main/.github/SECURITY.md`,
    "Preferred-Languages: en",
    `Canonical: ${SITE_ORIGIN}/.well-known/security.txt`,
    "",
  ].join("\n");
}
