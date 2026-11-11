import { cva, type VariantProps } from "class-variance-authority";

const toggleStyles = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-color-bg-border-shadow duration-(--duration-press) ease-(--ease-out-strong) outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
        chip: "shrink-0 cursor-pointer rounded-full border border-border bg-transparent text-xs font-semibold hover:bg-secondary aria-disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary",
        segmented:
          "shrink-0 cursor-pointer border border-border bg-transparent text-xs font-medium hover:bg-muted aria-disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-muted aria-pressed:text-foreground",
      },
      size: {
        default:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-7 min-w-7 rounded-toggle px-2.5 text-compact has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        compact: "h-7 min-w-7 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        chip: "h-7 min-w-8 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        segmented:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 pointer-coarse:h-10",
        lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Class names for a toggle, resolved from `variant` and `size`. The toggle
 * group items use it so they share one look.
 * @param props - The variant and size selection.
 * @returns The class string.
 */
export function toggleVariants(props?: Parameters<typeof toggleStyles>[0]): string {
  return toggleStyles(props);
}

/** The `variant` and `size` props a toggle accepts. */
export type ToggleStyleProps = VariantProps<typeof toggleStyles>;
