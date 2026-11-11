import { loadEmojiManifest } from '../utils/emoji-manifest.js'
import type { EmojiManifest, SkinTone } from '../utils/types.js'

/**
 * An emoji of the catalog resolved from text.
 */
export interface EmojiMatch {
  /** The catalog id of the emoji. */
  id: string
  /** The skin tone found in the text; only set for emojis with skin tone variants. */
  skinTone?: SkinTone
}

/**
 * A catalog emoji found inside a longer text.
 */
export interface ExtractedEmoji extends EmojiMatch {
  /** The matched emoji text, as written in the input. */
  text: string
  /** UTF-16 offset of the match in the input. */
  index: number
  /** UTF-16 length of the match. */
  length: number
}

/**
 * Options for {@link searchEmojis}.
 */
export interface SearchEmojisOptions {
  /** Maximum number of results; defaults to 20. */
  limit?: number
}

type ManifestRecord = Record<string, EmojiManifest>
type NonEmptyGroup = [EmojiManifest, ...EmojiManifest[]]

const DEFAULT_SEARCH_LIMIT = 20
const VARIATION_SELECTOR_16 = /\u{FE0F}/gu
const SKIN_TONE_MODIFIERS = /[\u{1F3FB}-\u{1F3FF}]/gu
const EMOJI_CLUSTER =
  /[\u{1F1E6}-\u{1F1FF}]{2}|.(?:[\u{FE0E}\u{FE0F}\u{20E3}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]|\u{200D}.)*/gsu

const ZERO_WIDTH_JOINER = '\u{200D}'
const CODE_POINT_PREFIX = /^[\da-f]+(?:_[\da-f]+)*_/
const SHORTCODE = /^:([^\s:]+):$/
const SHORTCODES_IN_TEXT = /:[^\s:]+:/g

/**
 * Glyphs whose first entry in catalog order is the wrong emoji, mapped to the
 * id that should represent them. Applied only when the id is in the manifest.
 */
const CANONICAL_OVERRIDES: Readonly<Record<string, string>> = {
  '\u{267B}': 'recycle',
  '\u{26BD}': 'soccerball',
  '\u{1F44F}': 'clap',
  '\u{1F64C}': 'handsinair',
  '\u{1F428}': 'koala',
  '\u{1F436}': 'smiledog',
  '\u{1FABD}': 'wing',
}

const TONES: readonly SkinTone[] = [
  'light',
  'medium-light',
  'medium',
  'medium-dark',
  'dark',
]

interface UnicodeIndex {
  readonly canonical: Map<string, EmojiManifest>
  readonly diverse: Map<string, EmojiManifest>
}

const indexCache = new WeakMap<ManifestRecord, UnicodeIndex>()

/**
 * Removes the variation selector so text and catalog glyphs share one key.
 * @param text - One emoji, optionally with VS16 or skin tone modifiers.
 * @returns The text without VS16.
 */
function stripVariationSelector(text: string): string {
  return text.replaceAll(VARIATION_SELECTOR_16, '')
}

/**
 * Tells whether VS16 directly follows the first code point, which marks a
 * text-presentation base such as a copyright sign.
 * @param text - An emoji, if known.
 * @returns Whether the second code point is VS16.
 */
function hasVariationSelectorAfterBase(text: string | undefined): boolean {
  const base = text?.codePointAt(0)
  if (base === undefined) return false
  return text?.codePointAt(base > 0xff_ff ? 2 : 1) === 0xfe_0f
}

/**
 * Picks the emoji that represents a glyph shared by several entries: an id
 * prefixed with the glyph's code points, then a known override present in the
 * manifest, then the first entry in catalog order.
 * @param glyph - The VS16-free glyph.
 * @param group - Every entry sharing the glyph, in catalog order.
 * @param manifest - The loaded manifest.
 * @returns The canonical entry.
 */
function pickCanonicalEmoji(
  glyph: string,
  group: NonEmptyGroup,
  manifest: ManifestRecord,
): EmojiManifest {
  if (group.length === 1) return group[0]
  const prefix = Array.from(
    glyph,
    (character) => character.codePointAt(0)?.toString(16) ?? '',
  ).join('_')
  const prefixed = group.find(
    (emoji) =>
      CODE_POINT_PREFIX.test(emoji.id) && emoji.id.startsWith(`${prefix}_`),
  )
  if (prefixed) return prefixed
  const overrideId = CANONICAL_OVERRIDES[glyph]
  const override = overrideId ? manifest[overrideId] : undefined
  return override && group.includes(override) ? override : group[0]
}

/**
 * Indexes the catalog by its unicode without VS16, once per manifest. The
 * canonical map answers bare glyphs; the diverse map answers glyphs with a skin
 * tone, preferring the canonical entry when it has tones and otherwise the
 * first entry of the group that does.
 * @param manifest - The loaded manifest.
 * @returns Maps from VS16-free unicode to the canonical and the diverse entry.
 */
function indexByUnicode(manifest: ManifestRecord): UnicodeIndex {
  const cached = indexCache.get(manifest)
  if (cached) return cached
  const groups = new Map<string, NonEmptyGroup>()
  for (const emoji of Object.values(manifest)) {
    if (!emoji.unicode) continue
    const key = stripVariationSelector(emoji.unicode)
    const group = groups.get(key)
    if (group) group.push(emoji)
    else groups.set(key, [emoji])
  }
  const canonical = new Map<string, EmojiManifest>()
  const diverse = new Map<string, EmojiManifest>()
  for (const [key, group] of groups) {
    const picked = pickCanonicalEmoji(key, group, manifest)
    canonical.set(key, picked)
    const toned = picked.diverse ? picked : group.find((emoji) => emoji.diverse)
    if (toned) diverse.set(key, toned)
  }
  const index = { canonical, diverse }
  indexCache.set(manifest, index)
  return index
}

/**
 * Resolves one emoji text against an already loaded catalog. Emoji-presentation
 * bases match with or without VS16; text-presentation bases require it.
 * @param manifest - The loaded manifest.
 * @param text - A single emoji, with optional VS16 and skin tone modifiers.
 * @returns The match, or undefined when the text is not a catalog emoji.
 */
function resolveEmoji(
  manifest: ManifestRecord,
  text: string,
): EmojiMatch | undefined {
  const index = indexByUnicode(manifest)
  const plain = stripVariationSelector(text)
  const direct = index.canonical.get(plain)
  if (direct) {
    return !direct.unicode?.includes(ZERO_WIDTH_JOINER) &&
      hasVariationSelectorAfterBase(direct.unicode) &&
      !hasVariationSelectorAfterBase(text)
      ? undefined
      : { id: direct.id }
  }
  const modifiers = plain.match(SKIN_TONE_MODIFIERS)
  const base = index.diverse.get(plain.replaceAll(SKIN_TONE_MODIFIERS, ''))
  if (!modifiers || !base) return undefined
  if (new Set(modifiers).size > 1) return { id: base.id }
  const skinTone = TONES[(modifiers[0].codePointAt(0) ?? 0) - 0x1_f3_fb]
  return skinTone === undefined ? { id: base.id } : { id: base.id, skinTone }
}

/**
 * Resolves one `:name:` shortcode against an already loaded catalog: the exact
 * id wins, otherwise the first entry in catalog order whose id matches once its
 * code point prefix is removed.
 * @param manifest - The loaded manifest.
 * @param text - A shortcode with both colons.
 * @returns The match, or undefined when the text is not a known shortcode.
 */
function resolveShortcode(
  manifest: ManifestRecord,
  text: string,
): EmojiMatch | undefined {
  const name = SHORTCODE.exec(text)?.[1]?.toLowerCase()
  if (!name) return undefined
  let stripped: string | undefined
  for (const { id } of Object.values(manifest)) {
    if (id === name) return { id }
    if (!stripped && id.replace(CODE_POINT_PREFIX, '') === name) stripped = id
  }
  return stripped ? { id: stripped } : undefined
}

/**
 * Splits text into graphemes, falling back to a code point grouper that keeps
 * ZWJ sequences, variation selectors, skin tones, keycaps and flags together
 * when the runtime has no `Intl.Segmenter`.
 * @param text - Free text.
 * @returns The segments with their UTF-16 offsets.
 */
function segmentText(text: string): { segment: string; index: number }[] {
  if (typeof Intl.Segmenter === 'function') {
    return [
      ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
        text,
      ),
    ]
  }
  return Array.from(text.matchAll(EMOJI_CLUSTER), (match) => ({
    segment: match[0],
    index: match.index,
  }))
}

/**
 * Loads the shared manifest, resolving to undefined instead of rejecting.
 * @returns The manifest, or undefined when it could not be loaded.
 */
async function loadManifestOrUndefined(): Promise<ManifestRecord | undefined> {
  try {
    return await loadEmojiManifest()
  } catch {
    return undefined
  }
}

/**
 * Finds the catalog emoji for a single emoji character or sequence. Tolerates
 * the variation selector and maps skin tone modifiers to `skinTone`.
 * @param text - One emoji, optionally with VS16 or skin tone modifiers.
 * @returns The match, or undefined when unknown or when the manifest failed to load.
 */
export async function findEmojiByUnicode(
  text: string,
): Promise<EmojiMatch | undefined> {
  const manifest = await loadManifestOrUndefined()
  return manifest ? resolveEmoji(manifest, text) : undefined
}

/**
 * Finds the catalog emoji for a `:name:` shortcode. The name is matched against
 * ids, ignoring case: first the exact id, then the id without its code point
 * prefix. Shortcodes derive from ids, not from the manifest.
 * @param shortcode - A shortcode with both colons, such as `:fire:`.
 * @returns The match, or undefined when unknown or when the manifest failed to load.
 */
export async function findEmojiByShortcode(
  shortcode: string,
): Promise<EmojiMatch | undefined> {
  const manifest = await loadManifestOrUndefined()
  return manifest ? resolveShortcode(manifest, shortcode) : undefined
}

/**
 * Finds every catalog emoji in a text, segmenting it by grapheme so ZWJ
 * sequences stay whole. Known `:shortcodes:` count too; unknown ones are left
 * alone.
 * @param text - Free text that may contain emojis or shortcodes.
 * @returns The emojis in order of appearance; empty when there are none or the manifest failed to load.
 */
export async function extractEmojis(text: string): Promise<ExtractedEmoji[]> {
  const manifest = await loadManifestOrUndefined()
  if (!manifest) return []
  const found: ExtractedEmoji[] = []
  const add = (match: EmojiMatch | undefined, part: string, index: number) => {
    if (match) found.push({ ...match, text: part, index, length: part.length })
  }
  for (const { segment, index } of segmentText(text)) {
    add(resolveEmoji(manifest, segment), segment, index)
  }
  for (const { 0: code, index } of text.matchAll(SHORTCODES_IN_TEXT)) {
    add(resolveShortcode(manifest, code), code, index)
  }
  // eslint-disable-next-line unicorn/no-array-sort -- sorts a fresh array; toSorted is outside the ES2022 build lib
  return found.sort((left, right) => left.index - right.index)
}

/**
 * Searches the catalog by description, ignoring case.
 * @param query - The text to look for inside descriptions.
 * @param options - Optional result limit; a value that is not a positive number means no limit, except 0, which returns nothing.
 * @returns Matching emojis, at most `limit`; empty when the manifest failed to load.
 */
export async function searchEmojis(
  query: string,
  options: SearchEmojisOptions = {},
): Promise<EmojiMatch[]> {
  const manifest = await loadManifestOrUndefined()
  const needle = query.trim().toLowerCase()
  if (!manifest || needle === '') return []
  const requested = options.limit ?? DEFAULT_SEARCH_LIMIT
  if (requested === 0) return []
  const limit = requested > 0 ? Math.floor(requested) : Infinity
  const results: EmojiMatch[] = []
  for (const emoji of Object.values(manifest)) {
    if (results.length >= limit) break
    if (emoji.description.toLowerCase().includes(needle)) {
      results.push({ id: emoji.id })
    }
  }
  return results
}
