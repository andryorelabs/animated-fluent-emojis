/**
 * Type declaration for `./brand-export-spec.mjs`, needed because this module
 * is imported from `brand-export-spec.test.ts` and TypeScript cannot infer
 * types across a `.ts` -> `.mjs` import without one.
 */
export declare const MARK_SIZES: number[];
export declare const APPLE_TOUCH_SIZE: number;
export declare const ICO_SIZES: number[];
export declare const KB: number;
export declare const MB: number;
export declare const COVER_SCALE: number;
export declare const WEBP_QUALITY: number;

export interface BannerOptions {
  width: number;
  height: number;
  theme: "dark" | "light";
  lockupSvg: string;
  fontFaces: string;
  emojiUris: readonly [string, string, string];
}

export interface ImageSpec {
  width: number;
  height: number;
  maxBytes: number;
}

export interface AssertSpecOptions {
  repositoryRoot?: string;
  log?: (message: string) => void;
}

export declare function bannerHtml(options: BannerOptions): string;

export declare function assertSpec(
  outPath: string,
  spec: ImageSpec,
  options?: AssertSpecOptions,
): Promise<void>;

export interface IcoImage {
  size: number;
  data: Buffer;
}

export declare function encodeIco(images: readonly IcoImage[]): Buffer;
