import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "@/lib/utilities";

/**
 * The shadcn separator on Base UI. A one-pixel rule in the border color,
 * horizontal by default.
 * @param props - Base UI separator props.
 * @returns The separator element.
 */
function Separator(props: SeparatorPrimitive.Props) {
  const { className, orientation = "horizontal", ...rest } = props;
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...rest}
    />
  );
}

export { Separator };
