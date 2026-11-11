import { Emoji } from "animated-fluent-emojis/react";
import { useEffect, useState, type CSSProperties } from "react";

import { usePrefersReducedMotion } from "./gallery/StageToolbar";

import "animated-fluent-emojis/style.css";

/** How long a burst stays mounted, matching the `copy-burst` animation. */
const BURST_MS = 600;

const PARTICLE_SIZE = 20;

/**
 * Where each particle ends up, as a direction in degrees (0 is right, 90 is
 * down), a distance in pixels and a spin in degrees. Directions fan out to the
 * left and below the button, away from the card edge that clips overflow.
 */
export const BURST_PARTICLES = [
  { angle: 70, distance: 40, spin: 40 },
  { angle: 105, distance: 28, spin: -55 },
  { angle: 140, distance: 48, spin: 70 },
  { angle: 175, distance: 32, spin: -35 },
  { angle: 200, distance: 44, spin: 50 },
] as const;

/**
 * The end offsets and rotation of one particle's flight, as the CSS values its
 * keyframes read through custom properties.
 */
interface ParticleOffsets {
  x: string;
  y: string;
  rotate: string;
}

/**
 * Converts a particle definition into the values its keyframes read.
 * @param particle - One entry of {@link BURST_PARTICLES}.
 * @param particle.angle - Direction in degrees, 0 pointing right.
 * @param particle.distance - Travel distance in pixels.
 * @param particle.spin - Rotation in degrees at the end of the flight.
 * @returns The end offsets and rotation as CSS lengths and angles.
 */
function particleOffsets({
  angle,
  distance,
  spin,
}: (typeof BURST_PARTICLES)[number]): ParticleOffsets {
  const radians = (angle * Math.PI) / 180;
  return {
    x: `${(Math.cos(radians) * distance).toFixed(1)}px`,
    y: `${(Math.sin(radians) * distance).toFixed(1)}px`,
    rotate: `${String(spin)}deg`,
  };
}

/**
 * Converts a particle definition into the custom properties its keyframes read.
 * @param particle - One entry of {@link BURST_PARTICLES}.
 * @returns The inline style carrying the end offsets and rotation.
 */
export function particleStyle(particle: (typeof BURST_PARTICLES)[number]): CSSProperties {
  const { x, y, rotate } = particleOffsets(particle);
  return {
    "--burst-x": x,
    "--burst-y": y,
    "--burst-rotate": rotate,
  } as CSSProperties;
}

/**
 * The particles of one burst. Unmounts itself once the animation has run.
 * @returns The particle layer, or nothing after `BURST_MS`.
 */
export function BurstParticles() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDone(true);
    }, BURST_MS);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, []);

  if (done) return null;
  return (
    <span aria-hidden="true" data-copy-burst className="pointer-events-none absolute inset-0 z-10">
      {BURST_PARTICLES.map((particle) => {
        const offsets = particleOffsets(particle);
        return (
          <span
            key={particle.angle}
            className="copy-burst-particle absolute top-1/2 left-1/2 -mt-2.5 -ml-2.5 size-5"
            style={
              {
                "--burst-x": offsets.x,
                "--burst-y": offsets.y,
                "--burst-rotate": offsets.rotate,
              } as CSSProperties
            }
          >
            <Emoji id="1f389_partypopper" size={PARTICLE_SIZE} alt="" animationIterations={1} />
          </span>
        );
      })}
    </span>
  );
}

/**
 * Properties of {@link CopyBurstView}.
 */
export interface CopyBurstViewProps {
  burst: number;
  reducedMotion: boolean;
}

/**
 * Renders the burst for a copy count. Every new count remounts the particles
 * through their key, so rapid copies restart the flight cleanly.
 * @param props - Component props.
 * @param props.burst - How many successful copies have happened; 0 is none.
 * @param props.reducedMotion - Whether the visitor prefers reduced motion.
 * @returns The particles, or nothing before the first copy or under reduced
 * motion.
 */
export function CopyBurstView({ burst, reducedMotion }: CopyBurstViewProps) {
  return burst === 0 || reducedMotion ? null : <BurstParticles key={burst} />;
}

/**
 * Properties of {@link CopyBurst}.
 */
export interface CopyBurstProps {
  burst: number;
}

/**
 * A short burst of party poppers that flies out of its positioned parent. It
 * is decorative: hidden from assistive technology, never intercepts the
 * pointer and takes no space in the layout.
 * @param props - Component props.
 * @param props.burst - How many successful copies have happened; each increase
 * starts a new burst.
 * @returns The burst, or nothing under reduced motion.
 */
export default function CopyBurst({ burst }: CopyBurstProps) {
  const reducedMotion = usePrefersReducedMotion();
  return <CopyBurstView burst={burst} reducedMotion={reducedMotion} />;
}
