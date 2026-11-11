import type { ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Chip<Value extends string | number> {
  value: Value;
  label: string;
  leading?: ReactNode;
}

interface ChipGroupProps<Value extends string | number> {
  label: string;
  chips: readonly Chip<Value>[];
  selected: Value;
  onSelect: (value: Value) => void;
  disabled?: boolean;
  disabledHint?: string;
}

/**
 * A labelled row of single-choice chips. It scrolls horizontally on narrow
 * screens and wraps on wide ones. When disabled, chips stay focusable and
 * report `aria-disabled` but ignore changes.
 * @param props - Chip list, selected value, change handler and disabled state.
 * @returns The labelled row of chip buttons.
 */
export function ChipGroup<Value extends string | number>(props: ChipGroupProps<Value>) {
  const { label, chips, selected, onSelect, disabled = false, disabledHint } = props;
  return (
    <ToggleGroup
      aria-label={label}
      value={[String(selected)]}
      onValueChange={(next) => {
        const chip = chips.find((candidate) => String(candidate.value) === next[0]);
        if (chip && !disabled) onSelect(chip.value);
      }}
      className="max-w-full overflow-x-auto min-[860px]:flex-wrap"
    >
      <span className="shrink-0 text-xs font-semibold text-muted-foreground">{label}</span>
      {chips.map((chip) => (
        <ToggleGroupItem
          key={chip.value}
          value={String(chip.value)}
          variant="chip"
          size="chip"
          aria-disabled={disabled}
          title={disabled ? disabledHint : undefined}
        >
          {chip.leading === undefined ? (
            chip.label
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {chip.leading}
              {chip.label}
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
