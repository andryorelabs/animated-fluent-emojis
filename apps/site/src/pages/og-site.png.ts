import { readFile } from "node:fs/promises";
import path from "node:path";
import type { APIRoute } from "astro";

import { loadEmojiPageData } from "../emoji-pages/data";
import { fetchPng } from "../emoji-pages/fetch-png";
import { composeOgImage } from "../emoji-pages/og-image";
import { fileUrl } from "../gallery/public-index";
import { getUi } from "../i18n/ui";

const TEMPLATE_PATH = path.resolve(process.cwd(), "../../docs/brand/og/og.png");
const SITE_CARD_EMOJI = "fire";

export const GET: APIRoute = async () => {
  const { emojis } = await loadEmojiPageData("en");
  const emoji = emojis.find(({ slug }) => slug === SITE_CARD_EMOJI);
  if (!emoji) throw new Error(`Unknown emoji "${SITE_CARD_EMOJI}"`);
  const png = await fetchPng(fileUrl(emoji.urls.png));
  const image = await composeOgImage(
    await readFile(TEMPLATE_PATH),
    new Uint8Array(png),
    getUi("en").meta.siteName,
  );
  return new Response(new Uint8Array(image));
};
