import { readFile } from "node:fs/promises";
import path from "node:path";
import type { APIRoute } from "astro";

import { loadEmojiPageData } from "../../emoji-pages/data";
import { fetchPng } from "../../emoji-pages/fetch-png";
import { composeOgImage } from "../../emoji-pages/og-image";
import { fileUrl } from "../../gallery/public-index";

const TEMPLATE_PATH = path.resolve(process.cwd(), "../../docs/brand/og/og.png");

export async function getStaticPaths() {
  const { emojis } = await loadEmojiPageData("en");
  return emojis.map(({ slug }) => ({ params: { slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const { emojis } = await loadEmojiPageData("en");
  const emoji = emojis.find(({ slug }) => slug === params.slug);
  if (!emoji) throw new Error(`Unknown emoji "${String(params.slug)}"`);
  const png = await fetchPng(fileUrl(emoji.urls.png));
  const image = await composeOgImage(
    await readFile(TEMPLATE_PATH),
    new Uint8Array(png),
    emoji.description,
  );
  return new Response(new Uint8Array(image));
};
