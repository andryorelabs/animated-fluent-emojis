import { Emoji } from "animated-fluent-emojis/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import "animated-fluent-emojis/style.css";

const QUESTION_EMOJI_SIZE = 28;

export interface FaqEntry {
  id: string;
  emojiId: string;
  question: string;
  answer: string;
}

/**
 * Landing FAQ: one item is open at a time, the first by default, and every answer is present in
 * the server-rendered HTML. Each item carries `data-faq` with its id, so the
 * mascot beside the list can follow the open question with CSS alone, and a
 * small decorative emoji in a reserved box so nothing shifts when it loads.
 * @param props - Component props.
 * @param props.items - Question and answer pairs, already localized, with the
 * id of the emoji that illustrates each one.
 * @returns The expandable list of questions.
 */
export default function FaqAccordion({ items }: { items: FaqEntry[] }) {
  return (
    <Accordion
      hiddenUntilFound
      variant="faq"
      defaultValue={items.slice(0, 1).map((item) => item.id)}
      className="max-w-3xl"
    >
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id} data-faq={item.id}>
          <AccordionTrigger className="items-center">
            <span
              data-faq-emoji
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center motion-safe:transition-scale-rotate motion-safe:duration-300 motion-safe:ease-spring motion-safe:group-aria-expanded/accordion-trigger:scale-135 motion-safe:group-aria-expanded/accordion-trigger:-rotate-10"
            >
              <Emoji id={item.emojiId} size={QUESTION_EMOJI_SIZE} alt="" playOnHover />
            </span>
            <span className="min-w-0 flex-1">{item.question}</span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="pl-10">{item.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
