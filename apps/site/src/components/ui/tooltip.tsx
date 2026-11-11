import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utilities";

/**
 * The shadcn tooltip provider on Base UI. Shares the open delay between the
 * tooltips it wraps.
 * @param props - Base UI tooltip provider props.
 * @returns The provider, which renders no element of its own.
 */
function TooltipProvider(props: TooltipPrimitive.Provider.Props) {
  const { delay = 300, ...rest } = props;
  return <TooltipPrimitive.Provider delay={delay} {...rest} />;
}

/**
 * The tooltip root. Owns the open state of one tooltip.
 * @param props - Base UI tooltip root props.
 * @returns The tooltip root, which renders no element of its own.
 */
function Tooltip(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props} />;
}

/**
 * The element that shows the tooltip on hover and focus.
 * @param props - Base UI tooltip trigger props.
 * @returns The trigger element.
 */
function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

type TooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

/**
 * The tooltip surface, rendered in a portal and positioned against the
 * trigger. It fades and scales in over 100ms with the strong ease-out curve.
 * @param props - Popup props plus the positioner `side`, `sideOffset`, `align`
 * and `alignOffset`.
 * @returns The portaled, positioned popup.
 */
function TooltipContent(props: TooltipContentProps) {
  const {
    side = "top",
    sideOffset = 6,
    align = "center",
    alignOffset = 0,
    className,
    children,
    ...rest
  } = props;
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background transition-[opacity,scale] duration-100 ease-(--ease-out-strong) data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          {...rest}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
