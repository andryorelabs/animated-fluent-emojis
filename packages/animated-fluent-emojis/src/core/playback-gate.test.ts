import { expect, test } from "vitest";

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
} from "./playback-gate.js";

const animation = { framesCount: 20, fps: 10, firstFrame: 1 };

const config = (overrides: Partial<PlaybackGateConfig> = {}): PlaybackGateConfig => ({
  animation,
  playOnHover: false,
  animationIterations: 2,
  autoPlayRequested: true,
  prefersReducedMotion: false,
  isDocumentHidden: false,
  size: 100,
  ...overrides,
});

const ready = (): PlaybackGateState =>
  gateVisibilityChanged(gateImageLoaded(createPlaybackGateState()), true);

test("holds the first run until loaded and on screen", () => {
  const initial = resolvePlaybackGate(createPlaybackGateState(), config());
  expect(initial.isRunBlocked).toBe(true);
  expect(initial.state.hasRunStarted).toBe(false);
  expect(initial.style).toMatchObject({
    animationName: "none",
    animationPlayState: "paused",
  });

  const loadedOnly = resolvePlaybackGate(gateImageLoaded(createPlaybackGateState()), config());
  expect(loadedOnly.isRunBlocked).toBe(true);

  const visibleOnly = resolvePlaybackGate(
    gateVisibilityChanged(createPlaybackGateState(), true),
    config(),
  );
  expect(visibleOnly.isRunBlocked).toBe(true);
});

test("starts the run once loaded, on screen and visible", () => {
  const view = resolvePlaybackGate(ready(), config());
  expect(view.isRunBlocked).toBe(false);
  expect(view.state.hasRunStarted).toBe(true);
  expect(view.isInitialAnimationComplete).toBe(false);
  expect(view.style).toMatchObject({
    width: 100,
    animationDuration: "2s",
    animationTimingFunction: "steps(20)",
    animationIterationCount: 2,
    animationPlayState: "running",
    transform: "translateY(0%)",
  });
  expect(view.style).not.toHaveProperty("animationName");
});

test("a hidden tab pauses a started run without dropping the animation", () => {
  const started = resolvePlaybackGate(ready(), config()).state;
  const hidden = resolvePlaybackGate(started, config({ isDocumentHidden: true }));
  expect(hidden.isRunBlocked).toBe(true);
  expect(hidden.style).toMatchObject({ animationPlayState: "paused" });
  expect(hidden.style).not.toHaveProperty("animationName");
  const back = resolvePlaybackGate(hidden.state, config());
  expect(back.style).toMatchObject({ animationPlayState: "running" });
});

test("leaving the screen pauses a started run", () => {
  const started = resolvePlaybackGate(ready(), config()).state;
  const away = resolvePlaybackGate(gateVisibilityChanged(started, false), config());
  expect(away.isRunBlocked).toBe(true);
  expect(away.style).toMatchObject({ animationPlayState: "paused" });
});

test("a hidden tab holds a run that has not started", () => {
  const view = resolvePlaybackGate(ready(), config({ isDocumentHidden: true }));
  expect(view.isRunBlocked).toBe(true);
  expect(view.state.hasRunStarted).toBe(false);
  expect(view.style).toMatchObject({ animationName: "none" });
});

test("reduced motion disables autoplay", () => {
  const view = resolvePlaybackGate(
    createPlaybackGateState(),
    config({ prefersReducedMotion: true }),
  );
  expect(view.isInitialAnimationComplete).toBe(true);
  expect(view.style).toMatchObject({
    animationName: "none",
    animationPlayState: "paused",
  });
});

test("autoPlay false disables autoplay", () => {
  const view = resolvePlaybackGate(ready(), config({ autoPlayRequested: false }));
  expect(view.isInitialAnimationComplete).toBe(true);
  expect(view.isFiniteRun).toBe(false);
});

test("zero and negative iterations disable autoplay even when playing", () => {
  expect(
    resolvePlaybackGate(ready(), config({ animationIterations: 0 })).isInitialAnimationComplete,
  ).toBe(true);
  const view = resolvePlaybackGate(ready(), config({ animationIterations: -2, playing: true }));
  expect(view.isInitialAnimationComplete).toBe(true);
  expect(view.iterationCount).toBe(0);
});

test("playing true overrides autoPlay and reduced motion", () => {
  const view = resolvePlaybackGate(
    ready(),
    config({
      playing: true,
      autoPlayRequested: false,
      prefersReducedMotion: true,
    }),
  );
  expect(view.isInitialAnimationComplete).toBe(false);
  expect(view.isRunBlocked).toBe(false);
  expect(view.isFiniteRun).toBe(true);
  expect(view.style).toMatchObject({ animationPlayState: "running" });
});

test("playing true still waits for load and visibility", () => {
  const view = resolvePlaybackGate(createPlaybackGateState(), config({ playing: true }));
  expect(view.isRunBlocked).toBe(true);
  expect(view.style).toMatchObject({ animationName: "none" });
});

test("playing false holds the current frame", () => {
  const view = resolvePlaybackGate(ready(), config({ playing: false }));
  expect(view.isRunBlocked).toBe(true);
  expect(view.state.hasRunStarted).toBe(false);
  expect(view.style).toMatchObject({ animationName: "none" });

  const started = resolvePlaybackGate(ready(), config()).state;
  const paused = resolvePlaybackGate(started, config({ playing: false }));
  expect(paused.style).toMatchObject({ animationPlayState: "paused" });
  expect(paused.style).not.toHaveProperty("animationName");
});

test("playing flipping to false after a run starts completes the initial run when autoplay turns off", () => {
  const started = resolvePlaybackGate(ready(), config()).state;
  const off = resolvePlaybackGate(started, config({ animationIterations: 0 }));
  expect(off.state.hasInitialRunFinished).toBe(true);
});

test("animationend finishes the run and reports a finite end once", () => {
  const view = resolvePlaybackGate(ready(), config());
  const first = gateAnimationEnded(view.state, view.isFiniteRun);
  expect(first.shouldReportEnd).toBe(true);
  expect(first.state.hasInitialRunFinished).toBe(true);
  const second = gateAnimationEnded(first.state, view.isFiniteRun);
  expect(second.shouldReportEnd).toBe(false);

  const done = resolvePlaybackGate(second.state, config());
  expect(done.isInitialAnimationComplete).toBe(true);
  expect(done.style).toMatchObject({
    animationName: "none",
    animationPlayState: "paused",
  });
});

test("an infinite run never reports its end", () => {
  const view = resolvePlaybackGate(ready(), config({ animationIterations: "infinite" }));
  expect(view.isFiniteRun).toBe(false);
  const ended = gateAnimationEnded(view.state, view.isFiniteRun);
  expect(ended.shouldReportEnd).toBe(false);
  expect(ended.state.hasInitialRunFinished).toBe(true);
});

test("rearming allows a new report on re-attached listeners", () => {
  const ended = gateAnimationEnded(ready(), true);
  expect(gateAnimationEnded(ended.state, true).shouldReportEnd).toBe(false);
  const rearmed = gateRearmed(ended.state);
  expect(gateAnimationEnded(rearmed, true).shouldReportEnd).toBe(true);
  expect(gateRearmed(rearmed)).toBe(rearmed);
});

test("playOnHover loops after the initial run and keeps animating", () => {
  const view = resolvePlaybackGate(ready(), config({ playOnHover: true }));
  const ended = gateAnimationEnded(view.state, view.isFiniteRun).state;
  const after = resolvePlaybackGate(ended, config({ playOnHover: true }));
  expect(after.isInitialAnimationComplete).toBe(true);
  expect(after.style).toMatchObject({
    animationIterationCount: "infinite",
    animationPlayState: "running",
  });
  expect(after.style).not.toHaveProperty("animationName");
});

test("a source change resets every flag", () => {
  const ended = gateAnimationEnded(resolvePlaybackGate(ready(), config()).state, true).state;
  expect(gateSourceChanged()).toEqual(createPlaybackGateState());
  const fresh = resolvePlaybackGate(gateSourceChanged(), config());
  expect(fresh.isInitialAnimationComplete).toBe(false);
  expect(fresh.isRunBlocked).toBe(true);
  expect(ended.hasReportedEnd).toBe(true);
});

test("state transitions are no-ops when nothing changes", () => {
  const loaded = gateImageLoaded(createPlaybackGateState());
  expect(gateImageLoaded(loaded)).toBe(loaded);
  const visible = gateVisibilityChanged(loaded, true);
  expect(gateVisibilityChanged(visible, true)).toBe(visible);
});

test("no animation yields an empty style", () => {
  const view = resolvePlaybackGate(ready(), config({ animation: null }));
  expect(view.style).toEqual({});
});

test("computes the first-frame offset and a string size", () => {
  const view = resolvePlaybackGate(
    ready(),
    config({
      animation: { framesCount: 20, fps: 10, firstFrame: 6 },
      size: "100%",
    }),
  );
  expect(view.style).toMatchObject({
    width: "100%",
    transform: "translateY(-25%)",
  });
});
