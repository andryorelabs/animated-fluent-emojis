import type { SkinTone as LibrarySkinTone } from 'animated-fluent-emojis/react'

import type { CodeBlockTab } from '@/components/CodeBlock'

import type { PublicEmoji, SkinTone } from '../gallery/public-index'
import { generateSnippet, type SnippetKind } from '../gallery/snippets'
import type { SnippetSlot } from '../highlight/snippet-template'

export const DEMO_SIZES = [32, 64, 96, 128] as const

type DemoSize = (typeof DEMO_SIZES)[number]

export type DemoPlayId = 'hover' | 'load' | 'loop'

export type DemoToneId = 'default' | 'light' | 'medium' | 'dark'

export type DemoEmojiName =
  | 'wave'
  | 'fire'
  | 'party'
  | 'heart'
  | 'rocket'
  | 'grin'

/**
 * Pre-highlighted code block tabs, keyed by play and then by whether the
 * snippet carries a tone attribute.
 */
export type DemoTabs = Record<
  DemoPlayId,
  Record<'plain' | 'toned', readonly CodeBlockTab[]>
>

export interface DemoState {
  emojiId: string
  size: DemoSize
  tone: DemoToneId
  play: DemoPlayId
}

export const DEMO_EMOJIS: readonly { id: string; name: DemoEmojiName }[] = [
  { id: '1f44b_wavinghand', name: 'wave' },
  { id: 'fire', name: 'fire' },
  { id: '1f389_partypopper', name: 'party' },
  { id: 'heart', name: 'heart' },
  { id: 'launch', name: 'rocket' },
  { id: '1f600_grinningface', name: 'grin' },
]

export const DEMO_TONES: readonly { id: DemoToneId }[] = [
  { id: 'default' },
  { id: 'light' },
  { id: 'medium' },
  { id: 'dark' },
]

export const DEMO_PLAYS: readonly { id: DemoPlayId }[] = [
  { id: 'hover' },
  { id: 'load' },
  { id: 'loop' },
]

export const INITIAL_DEMO_STATE: DemoState = {
  emojiId: '1f44b_wavinghand',
  size: 96,
  tone: 'default',
  play: 'hover',
}

/**
 * Whether every control is still on its default.
 * @param state - The current demo state.
 * @returns True when nothing was changed.
 */
export function isInitialDemoState(state: DemoState): boolean {
  return (
    state.emojiId === INITIAL_DEMO_STATE.emojiId &&
    state.size === INITIAL_DEMO_STATE.size &&
    state.tone === INITIAL_DEMO_STATE.tone &&
    state.play === INITIAL_DEMO_STATE.play
  )
}

/**
 * The skin tone that actually applies: none when the emoji has no tones or
 * the default is picked.
 * @param emoji - The shown emoji.
 * @param state - The current control selection.
 * @returns The tone, or undefined for the default look.
 */
export function demoTone(
  emoji: PublicEmoji,
  state: DemoState,
): SkinTone | undefined {
  return emoji.tones.length === 0 || state.tone === 'default'
    ? undefined
    : state.tone
}

/**
 * Whether a press on the stage should start a hover play by hand. Mouse
 * presses already play through hover, and touch has none.
 * @param play - The selected play.
 * @param pointerType - The pointer event's `pointerType`.
 * @returns True for a touch or pen press while the play is hover.
 */
export function isTapPlayTrigger(
  play: DemoPlayId,
  pointerType: string,
): boolean {
  return play === 'hover' && pointerType !== 'mouse'
}

/**
 * Maps the demo controls to the library's Emoji props.
 * @param emoji - The shown emoji.
 * @param state - The selected size, skin tone and playback trigger.
 * @returns The props to spread on the demo emoji.
 */
export function demoEmojiProps(
  emoji: PublicEmoji,
  state: DemoState,
): {
  size: number
  skinTone?: LibrarySkinTone
  playOnHover: boolean
  autoPlay: boolean
  animationIterations?: 'infinite'
} {
  const skinTone = demoTone(emoji, state)
  return {
    size: state.size,
    playOnHover: state.play === 'hover',
    autoPlay: state.play !== 'hover',
    ...(skinTone && { skinTone }),
    ...(state.play === 'loop' && { animationIterations: 'infinite' as const }),
  }
}

/**
 * The plain snippet the copy button writes, always from `generateSnippet`.
 * @param emoji - The shown emoji.
 * @param kind - The framework tab.
 * @param state - The current control selection.
 * @returns The text a user pastes into their project.
 */
export function demoSnippetCode(
  emoji: PublicEmoji,
  kind: SnippetKind,
  state: DemoState,
): string {
  const tone = demoTone(emoji, state)
  return generateSnippet(emoji, kind, {
    size: state.size,
    play: state.play,
    ...(tone && { tone }),
  })
}

/**
 * The text for each placeholder token of the highlighted snippet.
 * @param emoji - The shown emoji.
 * @param state - The current control selection.
 * @returns New values for the id, size, unicode and, when it applies, tone.
 */
export function demoSlotValues(
  emoji: PublicEmoji,
  state: DemoState,
): Partial<Record<SnippetSlot, string>> {
  const tone = demoTone(emoji, state)
  return {
    id: emoji.id,
    size: String(state.size),
    unicode: emoji.unicode,
    ...(tone && { tone }),
  }
}
