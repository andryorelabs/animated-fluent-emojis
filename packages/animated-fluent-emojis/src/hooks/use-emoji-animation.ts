import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'

import { wireEmojiImage } from '../core/image-wiring.js'
import {
  createPlaybackGateState,
  gateAnimationEnded,
  gateImageLoaded,
  gateRearmed,
  gateSourceChanged,
  gateVisibilityChanged,
  resolvePlaybackGate,
  type PlaybackGateConfig,
  type PlaybackGateState,
} from '../core/playback-gate.js'
import type { EmojiManifest } from '../utils/index.js'
import { useDocumentHidden } from './use-document-hidden.js'
import { usePrefersReducedMotion } from './use-prefers-reduced-motion.js'

export interface EmojiPlaybackControls {
  playing?: boolean | undefined
  onPlaybackEnd?: (() => void) | undefined
}

export interface UseEmojiAnimationResult {
  isInitialAnimationComplete: boolean
  animationStyle: CSSProperties
  imageRef: RefObject<HTMLImageElement | null>
}

/**
 * Custom hook for managing emoji animation. Holds the core playback gate state
 * and wires the image element; every playback decision comes from the core.
 * @param emoji - The emoji manifest data or null if not loaded.
 * @param playOnHover - Whether to play the animation on hover.
 * @param animationIterations - The number of animation iterations.
 * @param autoPlayRequested - Whether to autoplay the animation. Ignored while the user prefers reduced motion.
 * Autoplay, including looping, runs only once the image has loaded, while the
 * emoji is on screen and while the document is visible.
 * @param size - The width of the image: a number of pixels or any CSS length.
 * @param spriteSource - The current sprite URL. A change re-attaches the listeners to the new image element.
 * @param hasSpriteFailed - Whether the current sprite failed and its image element is unmounted. Leaving that state re-attaches the listeners to the new element.
 * @param controls - Playback controls. `playing` overrides `autoPlay` and reduced motion (`true` runs the iterations, `false` holds the current frame); `onPlaybackEnd` is called once when a finite run ends.
 * @returns Animation state, inline style and the image element ref.
 */
export const useEmojiAnimation = (
  emoji: EmojiManifest | null,
  playOnHover: boolean,
  animationIterations: number | 'infinite',
  autoPlayRequested: boolean,
  size: number | string,
  spriteSource?: string,
  hasSpriteFailed = false,
  controls: EmojiPlaybackControls = {},
): UseEmojiAnimationResult => {
  const prefersReducedMotion = usePrefersReducedMotion()
  const { playing, onPlaybackEnd } = controls
  const emojiId = emoji?.id
  const [trackedSource, setTrackedSource] = useState(spriteSource)
  const [gateState, setGateState] = useState<PlaybackGateState>(
    createPlaybackGateState,
  )
  const hasSourceChanged = trackedSource !== spriteSource
  if (hasSourceChanged) {
    setTrackedSource(spriteSource)
    setGateState(gateSourceChanged())
  }
  const currentGateState = hasSourceChanged ? gateSourceChanged() : gateState
  const baseConfig: PlaybackGateConfig = {
    animation: emoji?.animation ?? null,
    playOnHover,
    animationIterations,
    autoPlayRequested,
    playing,
    prefersReducedMotion,
    isDocumentHidden: false,
    size,
  }
  const isDocumentHidden = useDocumentHidden(
    !resolvePlaybackGate(currentGateState, baseConfig)
      .isInitialAnimationComplete,
  )
  const view = resolvePlaybackGate(currentGateState, {
    ...baseConfig,
    isDocumentHidden,
  })
  if (view.state !== currentGateState) setGateState(view.state)

  const imageRef = useRef<HTMLImageElement>(null)
  const latestRef = useRef({
    onPlaybackEnd,
    isFiniteRun: view.isFiniteRun,
    state: view.state,
  })
  useEffect(() => {
    latestRef.current = {
      onPlaybackEnd,
      isFiniteRun: view.isFiniteRun,
      state: view.state,
    }
  })

  useEffect(() => {
    const imgElement = imageRef.current
    if (emojiId === undefined || !imgElement) return

    const apply = (update: (state: PlaybackGateState) => PlaybackGateState) => {
      latestRef.current.state = update(latestRef.current.state)
      setGateState(update)
    }
    apply(gateRearmed)
    return wireEmojiImage(imgElement, {
      onLoad: () => {
        apply(gateImageLoaded)
      },
      onVisibilityChange: (isVisible) => {
        apply((state) => gateVisibilityChanged(state, isVisible))
      },
      onAnimationEnd: () => {
        const result = gateAnimationEnded(
          latestRef.current.state,
          latestRef.current.isFiniteRun,
        )
        latestRef.current.state = result.state
        setGateState(result.state)
        if (result.shouldReportEnd) latestRef.current.onPlaybackEnd?.()
      },
    })
  }, [emojiId, spriteSource, hasSpriteFailed])

  return {
    isInitialAnimationComplete: view.isInitialAnimationComplete,
    animationStyle: view.style,
    imageRef,
  }
}
