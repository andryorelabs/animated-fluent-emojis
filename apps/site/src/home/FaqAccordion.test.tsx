import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import FaqAccordion from "./FaqAccordion";

const items = [
  {
    id: "chat",
    emojiId: "speechbubble",
    question: "Can I use these in chat?",
    answer: "Yes, as a GIF.",
  },
  {
    id: "speed",
    emojiId: "26a1_highvoltagesign",
    question: "Will they slow my page?",
    answer: "No, space is reserved.",
  },
];

function render(): string {
  return renderToString(<FaqAccordion items={items} />);
}

test("FaqAccordion keeps every question and answer in the server HTML", () => {
  const html = render();

  for (const item of items) {
    expect(html).toContain(item.question);
    expect(html).toContain(item.answer);
  }
});

test("FaqAccordion opens only the first item by default", () => {
  const html = render();

  expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(items.length - 1);
  const openTag = (id: string) =>
    new RegExp(`<div[^>]*data-faq="${id}"[^>]*>`).exec(html)?.[0] ?? "";

  expect(openTag("chat")).toContain("data-open");
  expect(openTag("speed")).not.toContain("data-open");
});

test("FaqAccordion tags each item so the mascot can follow the open one", () => {
  const html = render();

  expect(html).toContain('data-faq="chat"');
  expect(html).toContain('data-faq="speed"');
});

test("FaqAccordion renders one decorative emoji per question", () => {
  const html = render();

  expect(html).toContain("data-faq-emoji");
  expect(html.match(/data-faq-emoji/g)).toHaveLength(items.length);
  expect(html).toMatch(/data-faq-emoji[^>]*aria-hidden="true"/);
});
