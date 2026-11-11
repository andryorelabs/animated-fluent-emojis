import { Emoji } from "animated-fluent-emojis/react";
import type { CSSProperties } from "react";

import { effectiveTone, urlsForTone } from "../../gallery/filter";
import { fileUrl, type PublicEmoji, type SkinTone } from "../../gallery/public-index";
import type { GallerySize } from "../../gallery/url-state";

/**
 * Properties of {@link GalleryTileEmoji}.
 */
export interface GalleryTileEmojiProps {
  emoji: PublicEmoji;
  tone: SkinTone | undefined;
  size: GallerySize;
  armed: boolean;
}

/**
 * Draws a gallery tile's emoji as its static poster and mounts the animated
 * sprite only once the tile is armed, so the grid does not download a sprite
 * sheet for every tile up front.
 * @param props - The emoji, the global tone, the tile size and whether the
 * tile has been hovered or focused.
 * @returns The poster, with the animated emoji stacked over it when armed.
 */
export function GalleryTileEmoji(props: GalleryTileEmojiProps) {
  const { emoji, tone, size, armed } = props;
  const appliedTone = effectiveTone(emoji, tone);
  return (
    <span
      className="relative inline-grid size-(--tile-size)"
      style={{ "--tile-size": `${String(size)}px` } as CSSProperties}
    >
      <img
        src={fileUrl(urlsForTone(emoji, tone).png)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="col-start-1 row-start-1"
      />
      {armed && (
        <Emoji
          id={emoji.id}
          size={size}
          {...(appliedTone && { skinTone: appliedTone })}
          autoPlay={false}
          playOnHover
          alt=""
          className="col-start-1 row-start-1"
        />
      )}
    </span>
  );
}
