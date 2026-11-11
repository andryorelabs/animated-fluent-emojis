/**
 * Represents the animation properties of an emoji.
 */
interface Animation {
  /** The frames per second of the animation. */
  fps: number;
  /** The total number of frames in the animation. */
  framesCount: number;
  /** The index of the first frame in the animation. */
  firstFrame: number;
}

/**
 * The runtime-facing subset of an emoticon, as published in the slim manifest.
 */
interface SlimEmoticon {
  /** Unique identifier for the emoticon. */
  id: string;
  /** Human-readable description of the emoticon. */
  description: string;
  /** Entity tag for caching purposes. */
  etag: string;
  /** Whether this emoticon has diverse (skin tone) variants. */
  diverse: boolean;
  /** Animation properties for this emoticon. */
  animation: Animation;
  /** Whether the asset site also serves an HD sprite sheet for this emoticon. */
  hd?: boolean;
  /** The emoji as a Unicode string, used as the fallback glyph. */
  unicode?: string;
}

/**
 * An emoticon as published in the compact v1 slim manifest. Omitted fields
 * mean `fps` 24, `firstFrame` 1, `diverse` false and `hd` false.
 */
interface CompactEmoticon {
  /** Unique identifier for the emoticon. */
  id: string;
  /** Human-readable description of the emoticon. */
  description: string;
  /** Entity tag for caching purposes. */
  etag: string;
  /** The emoji as a Unicode string, used as the fallback glyph. */
  unicode?: string;
  /** Animation properties; `fps` and `firstFrame` are omitted at their defaults. */
  animation: Partial<Animation> & Pick<Animation, "framesCount">;
  /** Present and true when the emoticon has skin tone variants. */
  diverse?: true;
  /** Present and true when the asset site serves an HD sprite sheet. */
  hd?: true;
}

/**
 * The compact v1 slim manifest as fetched, before defaults are restored.
 */
export interface CompactManifest {
  /** The emoji categories. */
  categories: {
    id: string;
    title: string;
    description: string;
    emoticons: CompactEmoticon[];
  }[];
}

/**
 * Represents an individual emoticon of the full manifest, used by the asset pipeline.
 */
interface Emoticon {
  /** Unique identifier for the emoticon. */
  id: string;
  /** Human-readable description of the emoticon. */
  description: string;
  /** Array of shortcut strings to represent this emoticon. */
  shortcuts: string[];
  /** Unicode representation of the emoticon. */
  unicode: string;
  /** Entity tag for caching purposes. */
  etag: string;
  /** Whether this emoticon has diverse (skin tone) variants. */
  diverse: boolean;
  /** Animation properties for this emoticon. */
  animation: Animation;
  /** Set to `"official"` on emoticons sourced from the official repository. Ignored at runtime. */
  origin?: "official";
  /** Array of keywords associated with this emoticon. */
  keywords: string[];
}

/**
 * Represents a category of emoticons.
 */
interface Category {
  /** Unique identifier for the category. */
  id: string;
  /** The display title of the category. */
  title: string;
  /** A brief description of the category. */
  description: string;
  /** An array of Emoticon objects in this category. */
  emoticons: Emoticon[];
}

/**
 * Represents the entire manifest structure.
 */
export interface Manifest {
  /** An array of Category objects representing all emoji categories. */
  categories: Category[];
}

/**
 * A slim manifest entry with the title of its category.
 */
export interface EmojiManifest extends SlimEmoticon {
  /** The category to which this emoji belongs. */
  category: string;
}

/**
 * Skin tones an emoji can be rendered with.
 */
export type SkinTone = "default" | "light" | "medium-light" | "medium" | "medium-dark" | "dark";
