import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DOCS = path.join(ROOT, 'docs')
const INDEX = 'README.md'

const EXCLUDED_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /^EMOJI_LIST(_.+)?\.md$/, reason: 'generated emoji lists' },
  { pattern: /^brand\/tools\//, reason: 'brand tooling' },
  { pattern: /^brand\/brandbook\//, reason: 'brand tooling' },
  {
    pattern: /^adr\/002[789]-/,
    reason:
      'ADRs 0027 to 0029 are not in docs/README.md yet; the file is outside the ticket that added this test',
  },
  {
    pattern:
      /^(brand\/(apply-spec|brief|competitors|copy|naming|voice)|design\/README|guide\/[a-z]+)\.md$/,
    reason:
      "reached through a directory link in docs/README.md; listing each page there is outside this ticket's surfaces",
  },
]

function listMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return listMarkdownFiles(absolute)
    if (!entry.name.endsWith('.md')) return []
    return path.relative(DOCS, absolute).split(path.sep).join('/')
  })
}

describe('docs index', () => {
  test('every Markdown file under docs is linked from docs/README.md', () => {
    const index = readFileSync(path.join(DOCS, INDEX), 'utf8')
    const unindexed = listMarkdownFiles(DOCS)
      .filter((file) => file !== INDEX)
      .filter((file) =>
        EXCLUDED_PATTERNS.every(({ pattern }) => !pattern.test(file)),
      )
      .filter((file) => !index.includes(`](${file})`))
    expect(unindexed).toEqual([])
  })
})
