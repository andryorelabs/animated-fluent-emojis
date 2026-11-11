import type { ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Segment<Value extends string | number> {
  value: Value;
  label: string;
  leading?: ReactNode;
}

interface SegmentedControlProps<Value extends string | number> {
  label: string;
  segments: readonly Segment<Value>[];
  selected: Value;
  onSelect: (value: Value) => void;
  disabled?: boolean;
  disabledHint?: string;
}

/**
 * A labelled, wrapping group of single-choice segments for the gallery
 * sidebar. When disabled, segments stay focusable and report `aria-disabled`
 * but ignore changes.
 * @param props - Segment list, selected value, change handler and disabled state.
 * @returns The labelled group of segment buttons.
 */
export function SegmentedControl<Value extends string | number>(
  props: SegmentedControlProps<Value>,
) {
  const { label, segments, selected, onSelect, disabled = false, disabledHint } = props;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <ToggleGroup
        aria-label={label}
        value={[String(selected)]}
        onValueChange={(next) => {
          const segment = segments.find((candidate) => String(candidate.value) === next[0]);
          if (segment && !disabled) onSelect(segment.value);
        }}
        spacing="tight"
        className="flex-wrap"
      >
        {segments.map((segment) => (
          <ToggleGroupItem
            key={segment.value}
            value={String(segment.value)}
            variant="segmented"
            size="segmented"
            aria-disabled={disabled}
            title={disabled ? disabledHint : undefined}
          >
            {segment.leading === undefined ? (
              segment.label
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {segment.leading}
                {segment.label}
              </span>
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
