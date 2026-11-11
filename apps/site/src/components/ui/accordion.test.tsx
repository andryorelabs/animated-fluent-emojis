import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";

function renderAccordion() {
  return renderToString(
    <Accordion hiddenUntilFound>
      <AccordionItem value="a">
        <AccordionTrigger>Question</AccordionTrigger>
        <AccordionContent>Answer</AccordionContent>
      </AccordionItem>
    </Accordion>,
  );
}

test("the panel animates its height with the strong ease-out and keeps the answer in the HTML", () => {
  const html = renderAccordion();

  expect(html).toContain("Answer");
  expect(html).toContain("h-(--accordion-panel-height)");
  expect(html).toContain("transition-height");
  expect(html).toContain("data-starting-style:h-0");
  expect(html).toContain("data-ending-style:h-0");
  expect(html).toContain("ease-(--ease-out-strong)");
});

test("the chevron rotates with a transition on the rotate property", () => {
  expect(renderAccordion()).toContain("transition-rotate");
});
