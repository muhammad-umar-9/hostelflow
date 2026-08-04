import type { BedState } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES: Record<BedState, string> = {
  vacant: "bg-okt text-ok",
  occupied: "bg-tint text-p",
  held: "bg-warnt text-warn",
  maintenance: "bg-[#eff1f4] text-[#8a929d]",
  checkout: "bg-badt text-bad",
};

export function BedChip({
  id,
  state,
  onClick,
  selected,
}: {
  id: string;
  state: BedState;
  onClick?: () => void;
  selected?: boolean;
}) {
  const className = cn(
    "flex-1 rounded-xl py-2 text-center text-[11.5px] font-bold",
    TONES[state],
    selected && "bg-p text-white",
  );
  if (!onClick) return <span className={className}>{id}</span>;
  return (
    <button type="button" onClick={onClick} className={cn(className, "min-h-[38px]")}>
      {id}
    </button>
  );
}
