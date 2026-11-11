import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import fixture from "../../gallery/fixtures/public-index.json";
import { parsePublicIndex, type PublicEmoji } from "../../gallery/public-index";
import { getUi } from "../../i18n/ui";
import { CopySnippetButton } from "./CopySnippetButton";

const [first] = parsePublicIndex(fixture);
if (!first) throw new Error("fixture needs an emoji");
const emoji: PublicEmoji = first;
const strings = getUi("en").gallery;

function render(): string {
  return renderToString(
    <CopySnippetButton
      emoji={emoji}
      size={64}
      tone={undefined}
      strings={strings}
      onNotice={vi.fn()}
    />,
  );
}

describe("copy snippet button", () => {
  it("shows Copy React as the primary on first render", () => {
    expect(render()).toContain("Copy React");
  });

  it("names the chevron menu for assistive technology", () => {
    expect(render()).toContain(`aria-label="${strings.snippetMenuLabel}"`);
  });

  it("renders the primary and the chevron as one group", () => {
    const html = render();
    expect(html).toContain('data-slot="button-group"');
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
  });
});
