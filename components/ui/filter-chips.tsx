"use client";

import { cn } from "@/lib/utils";

export interface FilterChip<T extends string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string> {
  chips: FilterChip<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "solid" | "soft";
  className?: string;
}

export function FilterChips<T extends string>({
  chips,
  value,
  onChange,
  variant = "solid",
  className,
}: FilterChipsProps<T>) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4", className)}>
      {chips.map((chip) => {
        const active = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            onClick={() => onChange(chip.value)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
              active && variant === "solid" && "border-p bg-p text-white",
              active && variant === "soft" && "border-p bg-tint text-p",
              !active && "border-line bg-white text-mut hover:text-ink",
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
