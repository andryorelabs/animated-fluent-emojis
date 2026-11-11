import { normalizeIterations } from './normalize.js'

type PlaybackStyle = Readonly<Record<string, string | number>>

interface PlaybackAnimation {
  framesCount: number
  fps: number
  firstFrame: number
}

/** Facts the gate tracks per sprite source. Always replaced, never mutated. */
export interface PlaybackGateState {
  hasImageLoaded: boolean
  isOnScreen: boolean
  hasInitialRunFinished: boolean
  hasRunStarted: boolean
  hasReportedEnd: boolean
}

export interface PlaybackGateConfig {
  animation: PlaybackAnimation | null
  playOnHover: boolean
  animationIterations: number | 'infinite'
  autoPlayRequested: boolean
  playing?: boolean | undefined
  prefersReducedMotion: boolean
  isDocumentHidden: boolean
  size: number | string
}

export interface PlaybackGateView {
  state: PlaybackGateState
  iterationCount: number | 'infinite'
  isFiniteRun: boolean
  isInitialAnimationComplete: boolean
  isRunBlocked: boolean
  style: PlaybackStyle
}

export interface AnimationEndResult {
  state: PlaybackGateState
  shouldReportEnd: boolean
}

export const createPlaybackGateState = (): PlaybackGateState => ({
  hasImageLoaded: false,
  isOnScreen: false,
  hasInitialRunFinished: false,
  hasRunStarted: false,
  hasReportedEnd: false,
})

/**
 * The sprite source changed: load, visibility and run state start over.
 * @returns A fresh gate state.
 */
export const gateSourceChanged = (): PlaybackGateState =>
  createPlaybackGateState()

export const gateImageLoaded = (state: PlaybackGateState): PlaybackGateState =>
  state.hasImageLoaded ? state : { ...state, hasImageLoaded: true }

export const gateVisibilityChanged = (
  state: PlaybackGateState,
  isOnScreen: boolean,
): PlaybackGateState =>
  state.isOnScreen === isOnScreen ? state : { ...state, isOnScreen }

/**
 * Listeners were re-attached to a new image element, so the end of a finite run
 * may be reported again.
 * @param state - The current gate state.
 * @returns The state with the once-only end report re-armed.
 */
export const gateRearmed = (state: PlaybackGateState): PlaybackGateState =>
  state.hasReportedEnd ? { ...state, hasReportedEnd: false } : state

/**
 * An `animationend` event fired: the initial run is over and, for a finite run
 * that has not reported yet, the end is reported exactly once.
 * @param state - The current gate state.
 * @param isFiniteRun - Whether the current run is finite, from the resolved view.
 * @returns The next state and whether `onPlaybackEnd` should be called now.
 */
export const gateAnimationEnded = (
  state: PlaybackGateState,
  isFiniteRun: boolean,
): AnimationEndResult => {
  const finished = state.hasInitialRunFinished
    ? state
    : { ...state, hasInitialRunFinished: true }
  if (!isFiniteRun || state.hasReportedEnd) {
    return { state: finished, shouldReportEnd: false }
  }
  return {
    state: { ...finished, hasReportedEnd: true },
    shouldReportEnd: true,
  }
}

const settle = (
  state: PlaybackGateState,
  autoPlay: boolean,
  playing: boolean | undefined,
  isDocumentHidden: boolean,
): PlaybackGateState => {
  let current = state
  for (let pass = 0; pass < 3; pass += 1) {
    const isComplete = current.hasInitialRunFinished || !autoPlay
    const canAutoplay =
      current.hasImageLoaded && current.isOnScreen && !isDocumentHidden
    const isBlocked = !(isComplete || canAutoplay) || playing === false
    let next = current
    if (!isBlocked && !isComplete && !current.hasRunStarted) {
      next = { ...next, hasRunStarted: true }
    }
    if (!autoPlay && current.hasRunStarted && !current.hasInitialRunFinished) {
      next = { ...next, hasInitialRunFinished: true }
    }
    if (next === current) return current
    current = next
  }
  return current
}

const buildStyle = (
  config: PlaybackGateConfig,
  flags: {
    iterationCount: number | 'infinite'
    isInitialAnimationComplete: boolean
    isRunBlocked: boolean
    hasRunStarted: boolean
  },
): PlaybackStyle => {
  if (!config.animation) return {}
  const { framesCount, fps, firstFrame } = config.animation
  const isIdle = !config.playOnHover && flags.isInitialAnimationComplete
  return {
    width: config.size,
    ...((isIdle || (flags.isRunBlocked && !flags.hasRunStarted)) && {
      animationName: 'none',
    }),
    animationDuration: `${String(framesCount / fps)}s`,
    animationTimingFunction: `steps(${String(framesCount)})`,
    animationIterationCount:
      flags.isInitialAnimationComplete && config.playOnHover
        ? 'infinite'
        : flags.iterationCount,
    animationPlayState: isIdle || flags.isRunBlocked ? 'paused' : 'running',
    transform: `translateY(${String((-(firstFrame - 1) / framesCount) * 100)}%)`,
  }
}

/**
 * Resolves the playback gate: settles the derived run flags and builds the
 * plain CSS style. `playing` overrides autoplay and reduced motion; autoplay
 * waits for the loaded image, the viewport and a visible document.
 * @param state - The flags tracked for the current sprite source.
 * @param config - Inputs from props and the environment.
 * @returns The settled state and everything an adapter renders from it.
 */
export const resolvePlaybackGate = (
  state: PlaybackGateState,
  config: PlaybackGateConfig,
): PlaybackGateView => {
  const iterationCount = normalizeIterations(config.animationIterations)
  const { playing } = config
  const autoPlay =
    iterationCount !== 0 &&
    (playing !== undefined ||
      (config.autoPlayRequested && !config.prefersReducedMotion))
  const settled = settle(state, autoPlay, playing, config.isDocumentHidden)
  const isInitialAnimationComplete = settled.hasInitialRunFinished || !autoPlay
  const canAutoplay =
    settled.hasImageLoaded && settled.isOnScreen && !config.isDocumentHidden
  const isRunBlocked =
    !(isInitialAnimationComplete || canAutoplay) || playing === false

  return {
    state: settled,
    iterationCount,
    isFiniteRun: autoPlay && iterationCount !== 'infinite',
    isInitialAnimationComplete,
    isRunBlocked,
    style: buildStyle(config, {
      iterationCount,
      isInitialAnimationComplete,
      isRunBlocked,
      hasRunStarted: settled.hasRunStarted,
    }),
  }
}
