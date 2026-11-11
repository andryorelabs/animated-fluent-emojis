import { expectTypeOf, test } from 'vitest'

import type {
  EmojiController,
  EmojiFallback,
  EmojiOptions,
  SkinTone,
} from '../index.js'

test('the published options keep their declared shape', () => {
  expectTypeOf<EmojiOptions>().toEqualTypeOf<{
    id: string
    size?: number | string | undefined
    playOnHover?: boolean | undefined
    animationIterations?: number | 'infinite' | undefined
    autoPlay?: boolean | undefined
    playing?: boolean | undefined
    onPlaybackEnd?: (() => void) | undefined
    skinTone?: SkinTone | undefined
    alt?: string | undefined
    fallback?: EmojiFallback | undefined
    onLoad?: ((event: Event) => void) | undefined
    onError?: ((event?: Event) => void) | undefined
    className?: string | undefined
    style?: Readonly<Record<string, string>> | undefined
    attributes?: Readonly<Record<string, string>> | undefined
  }>()
})

test('an explicit undefined clears an option through update', () => {
  expectTypeOf<{ fallback: undefined }>().toExtend<
    Parameters<EmojiController['update']>[0]
  >()
  expectTypeOf<{ id: string; size: undefined }>().toExtend<EmojiOptions>()
})
