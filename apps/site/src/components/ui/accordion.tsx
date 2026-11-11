import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";

import { cn } from "@/lib/utilities";

/**
 * The look of an accordion: the compact `default`, or `faq`, which ruled
 * rows with larger bold questions and muted answers.
 */
type AccordionVariant = "default" | "faq";

/**
 * The shadcn accordion root on Base UI. Pass `multiple` to let several items
 * stay open and `hiddenUntilFound` to keep closed answers findable.
 * @param props - Base UI accordion props and the optional `variant`.
 * @returns The accordion root element.
 */
function Accordion(props: AccordionPrimitive.Root.Props & { variant?: AccordionVariant }) {
  const { className, variant = "default", ...rest } = props;
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      data-variant={variant}
      className={cn("group/accordion flex w-full flex-col", className)}
      {...rest}
    />
  );
}

/**
 * One accordion item, a trigger plus the panel it controls.
 * @param props - Base UI accordion item props.
 * @returns The accordion item element.
 */
function AccordionItem(props: AccordionPrimitive.Item.Props) {
  const { className, ...rest } = props;
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(
        "group-data-[variant=faq]/accordion:border-b group-data-[variant=faq]/accordion:border-border group-data-[variant=faq]/accordion:first:border-t",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * The heading button that opens and closes its item, with a plus that
 * rotates into an x while the item is open.
 * @param props - Base UI accordion trigger props.
 * @returns The accordion header with its trigger button.
 */
function AccordionTrigger(props: AccordionPrimitive.Trigger.Props) {
  const { className, children, ...rest } = props;
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger flex flex-1 cursor-pointer items-start justify-between gap-3 rounded-lg py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          "group-data-[variant=faq]/accordion:py-4 group-data-[variant=faq]/accordion:text-base group-data-[variant=faq]/accordion:font-bold",
          className,
        )}
        {...rest}
      >
        {children}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none size-4 shrink-0 text-muted-foreground transition-rotate duration-250 ease-(--ease-out-strong) group-aria-expanded/accordion-trigger:rotate-45"
        >
          <path d="M8 3v10M3 8h10" />
        </svg>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

/**
 * The collapsible answer of an item. It stays mounted so the text is present
 * in the server-rendered HTML.
 * @param props - Base UI accordion panel props.
 * @returns The accordion panel element.
 */
function AccordionContent(props: AccordionPrimitive.Panel.Props) {
  const { className, children, ...rest } = props;
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      keepMounted
      className="group/accordion-panel h-(--accordion-panel-height) overflow-hidden text-sm transition-height duration-200 ease-(--ease-out-strong) data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-opacity motion-reduce:duration-150 motion-reduce:data-ending-style:h-(--accordion-panel-height) motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:h-(--accordion-panel-height) motion-reduce:data-starting-style:opacity-0"
      {...rest}
    >
      <div
        className={cn(
          "pt-0 pb-2.5 opacity-100 transition-opacity duration-200 ease-(--ease-out-strong) group-data-ending-style/accordion-panel:opacity-0 group-data-starting-style/accordion-panel:opacity-0 group-data-[variant=faq]/accordion:text-base group-data-[variant=faq]/accordion:text-muted-foreground motion-reduce:duration-150",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
