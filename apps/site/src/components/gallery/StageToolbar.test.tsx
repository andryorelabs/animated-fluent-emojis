import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getUi } from "../../i18n/ui";
import { resolvePlaying, StageToolbarControls, type StageBackground } from "./StageToolbar";

const strings = getUi("en").gallery;

function render(background: StageBackground, running: boolean): string {
  return renderToString(
    <StageToolbarControls
      strings={strings}
      background={background}
      onBackgroundChange={vi.fn()}
      running={running}
      onToggleRunning={vi.fn()}
    />,
  );
}

function pressedState(html: string, label: string): string | undefined {
  const pattern = new RegExp(String.raw`aria-label="${label}"[^>]*aria-pressed="(\w+)"`);
  return pattern.exec(html)?.[1];
}

describe("stage toolbar background group", () => {
  it("is a group labelled Background with four swatches", () => {
    const html = render("dots", true);
    expect(html).toContain(`role="group" aria-label="${strings.backgroundLabel}"`);
    for (const label of [
      strings.backgroundDots,
      strings.backgroundLight,
      strings.backgroundDark,
      strings.backgroundChecker,
    ]) {
      expect(pressedState(html, label)).toBeDefined();
    }
  });

  it("presses only the selected swatch", () => {
    const html = render("dark", true);
    expect(pressedState(html, strings.backgroundDark)).toBe("true");
    expect(pressedState(html, strings.backgroundDots)).toBe("false");
    expect(pressedState(html, strings.backgroundLight)).toBe("false");
    expect(pressedState(html, strings.backgroundChecker)).toBe("false");
  });

  it("selects Dots by default order and switches with the prop", () => {
    expect(pressedState(render("dots", true), strings.backgroundDots)).toBe("true");
    expect(pressedState(render("checker", true), strings.backgroundChecker)).toBe("true");
  });
});

describe("stage toolbar play button", () => {
  it("offers Pause animation while running", () => {
    expect(render("dots", true)).toContain(`aria-label="${strings.pauseAnimation}"`);
  });

  it("offers Play animation while paused", () => {
    expect(render("dots", false)).toContain(`aria-label="${strings.playAnimation}"`);
  });
});

describe("resolving playback", () => {
  it("runs by default and pauses under reduced motion", () => {
    expect(resolvePlaying(undefined, false)).toBe(true);
    expect(resolvePlaying(undefined, true)).toBe(false);
  });

  it("lets an explicit choice win over the motion preference", () => {
    expect(resolvePlaying(true, true)).toBe(true);
    expect(resolvePlaying(false, false)).toBe(false);
  });
});
