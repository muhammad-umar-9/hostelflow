import { cn } from "@/lib/utils";

export function ScreenshotPlaceholder({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-2xl border border-line bg-[repeating-linear-gradient(135deg,#f7f8fa,#f7f8fa_8px,#f1f3f6_8px,#f1f3f6_16px)] px-5 text-center font-mono text-[11px] leading-relaxed text-mut",
        className,
      )}
    >
      {label}
    </div>
  );
}
