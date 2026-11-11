/**
 * Options every adapter must accept. They are the framework-neutral subset of
 * the shared emoji options; a driver forwards them unchanged.
 */
export interface ConformanceOptions {
  id: string;
  size?: number;
  animationIterations?: number | "infinite";
  autoPlay?: boolean;
  playing?: boolean;
  alt?: string;
  onPlaybackEnd?: () => void;
  onError?: () => void;
}

/**
 * The glue between the shared behaviour spec and one framework adapter. The
 * spec observes the rendered DOM only, so a driver just mounts, updates and
 * unmounts an emoji inside the container it is given.
 */
export interface ConformanceDriver {
  /** Renders the emoji into `container` and resolves once it is mounted. */
  mount: (container: HTMLElement, options: ConformanceOptions) => void | Promise<void>;
  /** Re-renders the mounted emoji with `options` replacing the previous ones. */
  update: (options: ConformanceOptions) => void | Promise<void>;
  /** Removes the emoji and releases everything the adapter holds. */
  unmount: () => void | Promise<void>;
}

/**
 * Creates a fresh driver; the spec calls it once per test so no state leaks.
 */
export type ConformanceDriverFactory = () => ConformanceDriver;
