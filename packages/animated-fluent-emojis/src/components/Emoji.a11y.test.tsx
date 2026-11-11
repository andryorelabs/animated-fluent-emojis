import axe from "axe-core";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { Emoji } from "./Emoji.js";

const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

const expectNoBlockingViolations = async (container: Element) => {
  const { violations } = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
  });

  const blocking = violations.filter(
    (violation) => violation.impact != null && BLOCKING_IMPACTS.has(violation.impact),
  );
  expect(blocking).toEqual([]);
};

test("has no serious or critical WCAG A/AA violations", async () => {
  const { container } = await render(<Emoji id="cat" />);
  await expect.element(page.getByRole("img", { name: "Cat" })).toBeVisible();

  await expectNoBlockingViolations(container);
});

test("has no violations when decorative", async () => {
  const { container } = await render(<Emoji id="cat" alt="" />);
  await expect.poll(() => container.querySelector("img")).not.toBeNull();

  await expectNoBlockingViolations(container);
});

test("has no violations in the glyph fallback state", async () => {
  const { container } = await render(<Emoji id="cat" />);
  await expect.poll(() => container.querySelector("img")).not.toBeNull();
  container.querySelector("img")?.dispatchEvent(new Event("error"));

  await expect.poll(() => container.querySelector("img")).toBeNull();

  await expectNoBlockingViolations(container);
});

test("has no violations while hovered with playOnHover", async () => {
  const { container } = await render(<Emoji id="cat" playOnHover />);
  const image = page.getByRole("img", { name: "Cat" });
  await expect.element(image).toBeVisible();
  await userEvent.hover(image);

  await expectNoBlockingViolations(container);
});
