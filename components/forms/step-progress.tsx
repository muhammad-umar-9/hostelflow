import { cn } from "@/lib/utils";

export function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-label={"Step " + step + " of " + total}>
      {Array.from({ length: total }).map((_, index) => {
        const position = index + 1;
        return (
          <span
            key={position}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              position < step && "bg-ok",
              position === step && "bg-p",
              position > step && "bg-line",
            )}
          />
        );
      })}
    </div>
  );
}
