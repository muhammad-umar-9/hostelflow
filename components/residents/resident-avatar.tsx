import { cn } from "@/lib/utils";

export function ResidentAvatar({
  initials,
  color,
  className,
}: {
  initials: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}
