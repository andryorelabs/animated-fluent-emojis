/**
 * Crawlers that index the site for a search engine. They are allowed.
 */
export const SEARCH_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
] as const;

/**
 * Crawlers that fetch a page on behalf of a user asking an AI assistant. They
 * are allowed.
 */
export const ANSWER_CRAWLERS = ["ChatGPT-User", "Claude-User", "Perplexity-User"] as const;

/**
 * Crawlers that collect pages to train models. They are disallowed.
 * `Google-Extended` is not listed: blocking it also removes Gemini grounding
 * and does not affect Search.
 */
export const TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Applebot-Extended",
  "Bytespider",
] as const;
