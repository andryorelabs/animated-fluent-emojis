import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "./button-group";

test("ButtonGroup renders a horizontal group of its children", () => {
  const html = renderToString(
    <ButtonGroup>
      <button type="button">One</button>
    </ButtonGroup>,
  );

  expect(html).toContain('role="group"');
  expect(html).toContain('data-slot="button-group"');
  expect(html).toContain('data-orientation="horizontal"');
});

test("ButtonGroup supports the vertical orientation", () => {
  const html = renderToString(<ButtonGroup orientation="vertical" />);

  expect(html).toContain('data-orientation="vertical"');
});

test("ButtonGroupText and ButtonGroupSeparator render their slots", () => {
  const html = renderToString(
    <ButtonGroup>
      <ButtonGroupText>https://</ButtonGroupText>
      <ButtonGroupSeparator />
    </ButtonGroup>,
  );

  expect(html).toContain("https://");
  expect(html).toContain('data-slot="button-group-separator"');
});
