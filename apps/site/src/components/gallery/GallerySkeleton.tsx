import type { GallerySize } from "../../gallery/url-state";

/**
 * The grid track minimum class for each gallery size, written out in full so
 * Tailwind keeps the classes.
 */
export const GRID_COLUMNS: Record<GallerySize, string> = {
  64: "grid-cols-[repeat(auto-fill,minmax(96px,1fr))]",
  96: "grid-cols-[repeat(auto-fill,minmax(128px,1fr))]",
  128: "grid-cols-[repeat(auto-fill,minmax(160px,1fr))]",
};

const SKELETON_CELLS = 96;

/**
 * Properties of {@link GallerySkeleton}.
 */
export interface GallerySkeletonProps {
  label: string;
  size: GallerySize;
}

/**
 * The gallery's loading placeholder. It renders the real shell (the 240px
 * sidebar column from 860px up, the search toolbar row and the grid cells) so
 * nothing moves when the grid replaces it. It renders without JavaScript, so
 * the static page uses it as the island's fallback too.
 * @param props - The accessible label and the grid size to reserve.
 * @returns The placeholder shell.
 */
export function GallerySkeleton(props: GallerySkeletonProps) {
  const { label, size } = props;
  return (
    <div role="status" aria-label={label} className="grid gap-6 min-[860px]:grid-cols-sidebar">
      <div aria-hidden="true" className="hidden min-[860px]:block" />
      <div className="flex min-w-0 flex-col gap-4">
        <div className="shimmer h-9 rounded-10 bg-secondary" />
        <div className={`grid w-full ${GRID_COLUMNS[size]} gap-2`}>
          {Array.from({ length: SKELETON_CELLS }, (_, position) => (
            <div key={position} className="shimmer aspect-square rounded-10 bg-secondary" />
          ))}
        </div>
      </div>
    </div>
  );
}
