import { ExpressiveCode, loadShikiTheme } from "expressive-code";
import type { Element, ElementContent } from "hast";
import { toHtml } from "hast-util-to-html";

import type { PlayMode } from "../gallery/snippets";
import { sharedCodeConfig } from "./code-config";
import {
  SLOT_SENTINELS,
  SNIPPET_SLOTS,
  snippetTemplateText,
  TEMPLATE_LANGUAGES,
  type SnippetSlot,
  type TemplateKind,
} from "./snippet-template";

export interface RenderedSnippet {
  html: string;
  styles: string;
  slots: SnippetSlot[];
}

export interface SnippetRenderer {
  render: (kind: TemplateKind, withTone: boolean, play?: PlayMode) => Promise<RenderedSnippet>;
  renderCode: (code: string, language: string) => Promise<RenderedSnippet>;
  sharedStyles: () => Promise<string>;
}

function clonePiece(token: Element, value: string, slot?: SnippetSlot): Element {
  return {
    type: "element",
    tagName: "span",
    properties: {
      ...token.properties,
      ...(slot && { dataSnippetSlot: slot }),
    },
    children: [{ type: "text", value }],
  };
}

function splitToken(token: Element, found: SnippetSlot[]): ElementContent[] {
  const [child] = token.children;
  if (token.children.length !== 1 || child?.type !== "text") {
    return [token];
  }
  const slot = SNIPPET_SLOTS.find((candidate) => child.value.includes(SLOT_SENTINELS[candidate]));
  if (!slot) {
    return [token];
  }
  const sentinel = SLOT_SENTINELS[slot];
  const index = child.value.indexOf(sentinel);
  const before = child.value.slice(0, index);
  const after = child.value.slice(index + sentinel.length);
  found.push(slot);
  return [
    ...(before ? [clonePiece(token, before)] : []),
    clonePiece(token, sentinel, slot),
    ...(after ? splitToken(clonePiece(token, after), found) : []),
  ];
}

function isolateSlots(node: Element, found: SnippetSlot[]): void {
  node.children = node.children.flatMap((child) => {
    if (child.type !== "element") {
      return [child];
    }
    if (
      child.tagName === "span" &&
      child.children.every((grandchild) => grandchild.type === "text")
    ) {
      return splitToken(child, found);
    }
    isolateSlots(child, found);
    return [child];
  });
}

/**
 * Creates the build-time renderer for snippet templates. It highlights each
 * template with the shared Expressive Code configuration and isolates every
 * placeholder into its own `data-snippet-slot` token, so the client can swap a
 * value by replacing that token's text alone.
 * @returns A renderer that produces one highlighted snippet per call.
 */
export async function createSnippetRenderer(): Promise<SnippetRenderer> {
  const themes = await Promise.all(sharedCodeConfig.themes.map((name) => loadShikiTheme(name)));
  const engine = new ExpressiveCode({
    ...sharedCodeConfig,
    themes,
    plugins: [...sharedCodeConfig.plugins],
    frames: false,
  });
  async function renderCode(code: string, language: string): Promise<RenderedSnippet> {
    const { renderedGroupAst, styles } = await engine.render({ code, language });
    const found: SnippetSlot[] = [];
    isolateSlots(renderedGroupAst, found);
    return {
      html: toHtml(renderedGroupAst),
      styles: [...styles].join(""),
      slots: found,
    };
  }
  return {
    sharedStyles: async () =>
      [await engine.getBaseStyles(), await engine.getThemeStyles()].join(""),
    renderCode,
    render: (kind, withTone, play = "load") =>
      renderCode(snippetTemplateText(kind, withTone, play), TEMPLATE_LANGUAGES[kind]),
  };
}
