import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utilities";

const inputStyles = cva(
  "w-full border border-border bg-card transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "h-12 rounded-full px-5 text-base",
        search: "h-9 rounded-10 pr-14 pl-9 text-base pointer-fine:text-sm",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/**
 * The shadcn input on Base UI. Renders a native `<input>` with the brand pill
 * shape, card background and a visible focus ring. The `search` variant is the
 * compact, icon-padded field of the gallery toolbar.
 * @param props - Base UI input props plus `variant`.
 * @returns The styled input element.
 */
function Input(props: InputPrimitive.Props & VariantProps<typeof inputStyles>) {
  const { className, variant, ...rest } = props;
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(inputStyles({ variant }), className)}
      {...rest}
    />
  );
}

export { Input };
