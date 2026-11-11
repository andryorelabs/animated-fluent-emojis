const FINE_HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const detachNothing = () => {
  return;
};

/**
 * Makes a soft glow follow the pointer over the given cards by writing
 * `--spotlight-x` and `--spotlight-y` (px, relative to the card), at most once
 * per animation frame. It does nothing unless the primary pointer is fine and
 * hover-capable and the visitor has not asked for reduced motion.
 * @param cards - The elements that host the spotlight.
 * @returns A function that removes the listeners and cancels pending frames.
 */
export function attachPillarSpotlight(cards: Iterable<HTMLElement>): () => void {
  if (!matchMedia(FINE_HOVER_QUERY).matches || matchMedia(REDUCED_MOTION_QUERY).matches)
    return detachNothing;

  const detachers = [...cards].map((card) => {
    let frame: number | undefined;
    let clientX = 0;
    let clientY = 0;

    const onPointerMove = (event: PointerEvent) => {
      clientX = event.clientX;
      clientY = event.clientY;
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const { left, top } = card.getBoundingClientRect();
        card.style.setProperty("--spotlight-x", `${String(clientX - left)}px`);
        card.style.setProperty("--spotlight-y", `${String(clientY - top)}px`);
      });
    };

    card.addEventListener("pointermove", onPointerMove);
    return () => {
      card.removeEventListener("pointermove", onPointerMove);
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    };
  });

  return () => {
    for (const detach of detachers) detach();
  };
}
