import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utilities";

/**
 * The shadcn sheet root on Base UI Dialog. It is modal by default: focus is
 * trapped while open and Escape closes it. Pass `modal={false}` for a docked
 * panel that leaves the page interactive.
 * @param props - Base UI dialog root props.
 * @returns The sheet root.
 */
function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

/**
 * The button that closes the sheet. Use `render` to style it as a `Button`.
 * @param props - Base UI dialog close props.
 * @returns The close button element.
 */
function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/**
 * The dimming layer behind the sheet panel.
 * @param props - Base UI dialog backdrop props.
 * @returns The backdrop element.
 */
function SheetOverlay(props: SheetPrimitive.Backdrop.Props) {
  const { className, ...rest } = props;
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-40 bg-foreground/40 transition-opacity duration-250 ease-(--ease-out-strong) data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:opacity-0",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Properties of {@link SheetContent}.
 */
interface SheetContentProps extends SheetPrimitive.Popup.Props {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
  closeLabel?: string;
  showOverlay?: boolean;
  flush?: boolean;
}

const SIDE_CLASSES = {
  top: "inset-x-0 top-0 max-h-[80dvh] rounded-b-brand border-b data-ending-style:-translate-y-full data-starting-style:-translate-y-full motion-reduce:data-ending-style:translate-y-0 motion-reduce:data-starting-style:translate-y-0",
  right:
    "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l data-ending-style:translate-x-full data-starting-style:translate-x-full motion-reduce:data-ending-style:translate-x-0 motion-reduce:data-starting-style:translate-x-0",
  bottom:
    "inset-x-0 bottom-0 max-h-[80dvh] rounded-t-brand border-t pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:data-ending-style:translate-y-0 motion-reduce:data-starting-style:translate-y-0",
  left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r data-ending-style:-translate-x-full data-starting-style:-translate-x-full motion-reduce:data-ending-style:translate-x-0 motion-reduce:data-starting-style:translate-x-0",
} as const;

/**
 * The sheet panel, portaled to the document body and anchored to one screen
 * edge, with an optional dimming backdrop and corner close button.
 * @param props - Base UI dialog popup props, the screen edge as `side`,
 * whether to render the backdrop (`showOverlay`, default true) and an
 * optional corner close button (`showCloseButton`, default false, labelled
 * by `closeLabel`). `flush` removes the panel padding, so the content owns
 * its own spacing.
 * @returns The portaled backdrop and panel.
 */
function SheetContent(props: SheetContentProps) {
  const {
    className,
    children,
    side = "right",
    showCloseButton = false,
    closeLabel = "Close",
    showOverlay = true,
    flush = false,
    ...rest
  } = props;
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      {showOverlay && <SheetOverlay />}
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 overflow-y-auto overscroll-contain border border-border bg-card p-5 transition-opacity-translate duration-(--duration-sheet) ease-(--ease-drawer) outline-none data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-(--ease-out-strong) data-starting-style:opacity-0",
          SIDE_CLASSES[side],
          flush && "p-0",
          className,
        )}
        {...rest}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" />}
          >
            <XIcon />
            <span className="sr-only">{closeLabel}</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetClose, SheetContent };
