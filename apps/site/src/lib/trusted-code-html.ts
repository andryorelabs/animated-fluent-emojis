/**
 * The slice of the browser's `window.trustedTypes` the code blocks use.
 */
export interface CodeHtmlFactory {
  createPolicy(
    name: string,
    rules: { createHTML: (input: string) => string },
  ): { createHTML: (input: string) => TrustedHTML };
}

const POLICY_NAME = "afe-code";
const policies = new WeakMap<CodeHtmlFactory, ReturnType<CodeHtmlFactory["createPolicy"]>>();

/**
 * Wraps highlighted code markup as Trusted Types HTML so React can assign it
 * to `innerHTML` under the `require-trusted-types-for 'script'` CSP directive.
 * Only build-time highlighter output may reach this function, so the policy
 * passes its input through unchanged, and it is a named policy rather than the
 * page's `default` one so it never widens what other sinks accept.
 * @param html - Markup produced by the build-time highlighter.
 * @param factory - The page's `window.trustedTypes`, absent in browsers
 * without Trusted Types, where the plain string is already accepted.
 * @returns A `TrustedHTML` object, or the plain string without Trusted Types.
 */
export function trustedCodeHtml(
  html: string,
  factory: CodeHtmlFactory | undefined = (globalThis as { trustedTypes?: CodeHtmlFactory })
    .trustedTypes,
): string | TrustedHTML {
  if (!factory) return html;
  let policy = policies.get(factory);
  if (!policy) {
    policy = factory.createPolicy(POLICY_NAME, {
      createHTML: (input) => input,
    });
    policies.set(factory, policy);
  }
  return policy.createHTML(html);
}
