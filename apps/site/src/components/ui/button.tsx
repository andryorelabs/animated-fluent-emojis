import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utilities";

const PRESS_CLASSES = "active:scale-97 ease-(--ease-out-strong)";

const buttonStyles = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center bg-clip-padding text-sm font-medium whitespace-nowrap transition-color-bg-border-shadow-filter-scale duration-(--duration-press) select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground hover:brightness-95 ${PRESS_CLASSES}`,
        outline: `border border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground ${PRESS_CLASSES}`,
        secondary: `bg-secondary text-secondary-foreground hover:brightness-95 ${PRESS_CLASSES}`,
        ghost: `hover:bg-muted hover:text-foreground ${PRESS_CLASSES}`,
        destructive: `bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20 ${PRESS_CLASSES}`,
        quiet: `text-muted-foreground hover:bg-muted hover:text-foreground ${PRESS_CLASSES}`,
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5",
        sm: "h-8 gap-1 px-2.5 text-compact",
        lg: "h-9 gap-1.5 px-2.5",
        cta: "h-10 gap-1.5 px-5 font-semibold",
        close: "h-8 gap-1.5 px-3 font-semibold",
        icon: "size-8 pointer-coarse:size-10",
        "icon-sm": "size-8 pointer-coarse:size-10",
      },
      shape: {
        default: "rounded-lg",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  },
);

/**
 * Class names for a button, resolved from `variant`, `size` and `shape`
 * (`pill` is the brand `rounded-full` shape) and merged with any `className`.
 * Use it on static Astro elements that need button styling without shipping
 * React.
 * @param props - The variant selection and an optional `className`.
 * @returns The merged class string.
 */
function buttonVariants(props?: Parameters<typeof buttonStyles>[0]): string {
  return cn(buttonStyles(props));
}

/**
 * The shadcn button on Base UI. Renders a native `<button>` styled through
 * {@link buttonVariants}.
 * @param props - Base UI button props plus `variant`, `size` and `shape`.
 * @returns The styled button element.
 */
function Button(props: ButtonPrimitive.Props & VariantProps<typeof buttonStyles>) {
  const { className, variant, size, shape, ...rest } = props;
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, shape, className })}
      {...rest}
    />
  );
}

export { Button, buttonVariants };
