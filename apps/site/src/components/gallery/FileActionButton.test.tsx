import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getUi } from "../../i18n/ui";
import { FileActionButton } from "./FileActionButton";

const strings = getUi("en").gallery;

function render(): string {
  return renderToString(
    <FileActionButton
      target={{ filenameBase: "wave", urlFor: (format) => `/wave.${format}` }}
      strings={strings}
      onNotice={vi.fn()}
    />,
  );
}

describe("file action button", () => {
  it("shows Download WebP as the primary on first render", () => {
    expect(render()).toContain(strings.fileActionDownloadWebp);
  });

  it("names the chevron menu for assistive technology", () => {
    expect(render()).toContain(`aria-label="${strings.fileActionMenuLabel}"`);
  });

  it("renders the primary and the chevron as one group", () => {
    const html = render();
    expect(html).toContain('data-slot="button-group"');
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
  });
});
