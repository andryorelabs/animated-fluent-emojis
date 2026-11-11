import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";

import { toggleVariants, type ToggleStyleProps } from "@/components/ui/toggle";
import { cn } from "@/lib/utilities";

const toggleGroupStyles = cva("flex w-fit flex-row items-center", {
  variants: {
    spacing: {
      default: "gap-2",
      tight: "gap-1",
    },
  },
  defaultVariants: {
    spacing: "default",
  },
});

/**
 * The shadcn toggle group on Base UI. Renders a `role="group"` container for
 * {@link ToggleGroupItem} children; label it with `aria-label`.
 * @param props - Base UI toggle group props plus `spacing`.
 * @returns The toggle group element.
 */
function ToggleGroup<Value extends string>(
  props: ToggleGroupPrimitive.Props<Value> & VariantProps<typeof toggleGroupStyles>,
) {
  const { className, spacing, ...rest } = props;
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(toggleGroupStyles({ spacing }), className)}
      {...rest}
    />
  );
}

/**
 * One pressable item of a {@link ToggleGroup}, styled through
 * {@link toggleVariants}.
 * @param props - Base UI toggle props plus `variant` and `size`.
 * @returns The toggle button.
 */
function ToggleGroupItem<Value extends string>(
  props: TogglePrimitive.Props<Value> & ToggleStyleProps,
) {
  const { className, variant, size, ...rest } = props;
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(toggleVariants({ variant, size }), className)}
      {...rest}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
