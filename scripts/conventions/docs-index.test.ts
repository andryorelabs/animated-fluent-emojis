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
