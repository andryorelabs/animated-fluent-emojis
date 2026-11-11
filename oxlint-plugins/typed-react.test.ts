import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { RuleTester } from 'oxlint/plugins-dev'
import { afterAll, describe, it } from 'vitest'

import typedReactPlugin from './typed-react.mjs'

RuleTester.describe = describe
RuleTester.it = it

/**
 * The parity fixture: `@eslint-react/no-leaked-conditional-rendering` under
 * ESLint reports lines 6, 7 and 11 (`count`, `items.length`, `Number.NaN`)
 * and accepts the string, boolean and comparison operands.
 */
const PARITY_FIXTURE = [
  'declare const count: number',
  'declare const items: string[]',
  'declare const label: string',
  'declare const ok: boolean',
  'export const views = [',
  '  <div key="count">{count && <span />}</div>,',
  '  <div key="items">{items.length && <span />}</div>,',
  '  <div key="label">{label && <span />}</div>,',
  '  <div key="ok">{ok && <span />}</div>,',
  '  <div key="positive">{count > 0 && <span />}</div>,',
  '  <div key="nan">{Number.NaN && <span />}</div>,',
  ']',
  '',
].join('\n')

const COVERED_CODE =
  'declare const ok: boolean\nexport const view = <div>{ok && <span />}</div>\n'

const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'typed-react-'))

afterAll(() => {
  rmSync(temporaryRoot, { recursive: true, force: true })
})

/**
 * Writes files under the temporary root and returns their absolute paths.
 * @param files File contents keyed by path relative to the root.
 * @returns Absolute paths keyed like `files`.
 */
function writeTree<Key extends string>(
  files: Record<Key, string>,
): Record<Key, string> {
  const written = {} as Record<Key, string>
  for (const [relative, contents] of Object.entries<string>(files)) {
    const absolute = path.join(temporaryRoot, relative)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, contents)
    written[relative as Key] = absolute
  }
  return written
}

const compilerOptions = { jsx: 'preserve', strict: true, composite: true }

const tree = writeTree({
  'solution/tsconfig.json': JSON.stringify({
    files: [],
    references: [{ path: './tsconfig.app.json' }],
  }),
  'solution/tsconfig.app.json': JSON.stringify({
    compilerOptions,
    include: ['src'],
  }),
  'solution/src/parity.tsx': PARITY_FIXTURE,
  'solution/src/covered.tsx': COVERED_CODE,
  'plain/tsconfig.json': JSON.stringify({ compilerOptions, include: ['src'] }),
  'plain/src/covered.tsx': COVERED_CODE,
  'uncovered/tsconfig.json': JSON.stringify({
    compilerOptions,
    include: ['src'],
  }),
  'uncovered/outside/stray.tsx': COVERED_CODE,
})

const ruleTester = new RuleTester()

ruleTester.run(
  'typed-react/no-leaked-conditional-rendering',
  typedReactPlugin.rules['no-leaked-conditional-rendering'],
  {
    valid: [
      {
        name: 'a boolean operand in a plain tsconfig project',
        code: COVERED_CODE,
        filename: tree['plain/src/covered.tsx'],
      },
      {
        name: 'a boolean operand in a project reached through a solution-style tsconfig',
        code: COVERED_CODE,
        filename: tree['solution/src/covered.tsx'],
      },
    ],
    invalid: [
      {
        name: 'the parity fixture reports the same lines as ESLint',
        code: PARITY_FIXTURE,
        filename: tree['solution/src/parity.tsx'],
        errors: [
          { messageId: 'default', line: 6 },
          { messageId: 'default', line: 7 },
          { messageId: 'default', line: 11 },
        ],
      },
      {
        name: 'a file no tsconfig covers is reported, not skipped',
        code: COVERED_CODE,
        filename: tree['uncovered/outside/stray.tsx'],
        errors: [{ messageId: 'uncoveredFile', line: 1 }],
      },
    ],
  },
)
