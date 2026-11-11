import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utilities";

/**
 * The shadcn dropdown menu root on Base UI. Owns the open state, keyboard
 * navigation and focus return to the trigger.
 * @param props - Base UI menu root props.
 * @returns The menu root, which renders no element of its own.
 */
function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />;
}

const splitTriggerStyles =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center border border-border bg-card text-card-foreground transition-color-bg-border-shadow-scale duration-(--duration-press) ease-(--ease-out-strong) outline-none select-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97";

type DropdownMenuTriggerProps = MenuPrimitive.Trigger.Props & {
  variant?: "default" | "split";
};

/**
 * The element that opens the menu. It renders a native button; the default
 * variant is unstyled so `render` can supply a `Button`, and `split` is the
 * chevron half of a split button inside a `ButtonGroup`, keeping the press
 * scale and the colour and shadow transition of an outline `Button`.
 * @param props - Base UI menu trigger props plus a `variant`.
 * @returns The trigger button.
 */
function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
  const { variant = "default", className, ...rest } = props;
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      className={cn(variant === "split" && splitTriggerStyles, className)}
      {...rest}
    />
  );
}

type DropdownMenuContentProps = MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "sideOffset" | "collisionPadding"> & {
    variant?: "default" | "nova" | "split";
  };

const defaultContentStyles = "rounded-brand border border-border bg-card p-2 shadow-lg";

const novaContentBase =
  "bg-popover p-1 ring-1 ring-foreground/10 scrollbar-subtle scrollbar-thin origin-(--transform-origin) transition-opacity-scale duration-150 ease-(--ease-out-strong) data-ending-style:scale-95 data-ending-style:duration-100 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0";

const novaContentStyles = `min-w-40 rounded-lg ${novaContentBase}`;

const splitContentStyles = `min-w-42 rounded-10 ${novaContentBase}`;

const contentStyles = {
  default: defaultContentStyles,
  nova: novaContentStyles,
  split: splitContentStyles,
};

/**
 * The menu surface, rendered in a portal and positioned against the trigger.
 * Styled with the brand card surface, border and radius.
 * @param props - Popup props plus the positioner `align`, `sideOffset` and
 * `collisionPadding`, and a `variant` (`nova` is the compact menu anatomy, `split` the same with the
 * wider, tighter-cornered panel under a split button).
 * @returns The portaled, positioned popup.
 */
function DropdownMenuContent(props: DropdownMenuContentProps) {
  const {
    align = "end",
    sideOffset = 8,
    collisionPadding = 8,
    variant = "default",
    className,
    ...rest
  } = props;
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="z-50 outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "max-h-(--available-height) origin-(--transform-origin) overflow-y-auto text-card-foreground outline-none",
            contentStyles[variant],
            className,
          )}
          {...rest}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

const itemStyles =
  "flex h-10 w-full cursor-pointer items-center rounded-full px-3 text-sm font-medium text-foreground outline-none select-none data-highlighted:bg-accent data-highlighted:text-primary-text aria-[current=true]:bg-accent";

export const compactLinkItemStyles =
  "flex h-8 w-full pointer-coarse:h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-normal text-foreground no-underline outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground aria-[current=true]:bg-transparent";

/**
 * A menu item that is a real link (`<a href>`), so it keeps working as
 * navigation and closes the menu when chosen. The `compact` variant is the
 * header menus' item; it never underlines because the popups portal to
 * `<body>`, outside the header, where Starlight's link decoration would
 * otherwise apply.
 * @param props - Base UI link item props, including `href`, plus a `variant`.
 * @returns The styled anchor.
 */
function DropdownMenuLinkItem(
  props: MenuPrimitive.LinkItem.Props & { variant?: "default" | "compact" },
) {
  const { variant = "default", className, ...rest } = props;
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      className={cn(variant === "compact" ? compactLinkItemStyles : itemStyles, className)}
      {...rest}
    />
  );
}

const novaItemStyles =
  "relative flex h-8 w-full pointer-coarse:h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50";

/**
 * Groups related items so a {@link DropdownMenuLabel} can name them.
 * @param props - Base UI menu group props.
 * @returns The group element.
 */
function DropdownMenuGroup(props: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

/**
 * A group of radio items that shares one selected value.
 * @param props - Base UI radio group props.
 * @returns The radio group element.
 */
function DropdownMenuRadioGroup(props: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/**
 * A radio item that shows a check on the right while it is the selected value.
 * @param props - Base UI radio item props, including `value`.
 * @returns The radio item element.
 */
function DropdownMenuRadioItem(props: MenuPrimitive.RadioItem.Props) {
  const { className, children, ...rest } = props;
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(novaItemStyles, "justify-between pr-8", className)}
      {...rest}
    >
      {children}
      <MenuPrimitive.RadioItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="size-4" />
      </MenuPrimitive.RadioItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

/**
 * A plain action item that runs `onClick` and closes the menu.
 * @param props - Base UI menu item props.
 * @returns The menu item element.
 */
function DropdownMenuItem(props: MenuPrimitive.Item.Props) {
  const { className, ...rest } = props;
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(novaItemStyles, className)}
      {...rest}
    />
  );
}

/**
 * A small muted heading for a group of menu items.
 * @param props - Base UI group label props.
 * @returns The label element.
 */
function DropdownMenuLabel(props: MenuPrimitive.GroupLabel.Props) {
  const { className, ...rest } = props;
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...rest}
    />
  );
}

/**
 * A hairline rule between menu sections.
 * @param props - Base UI menu separator props.
 * @returns The separator element.
 */
function DropdownMenuSeparator(props: MenuPrimitive.Separator.Props) {
  const { className, ...rest } = props;
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...rest}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
