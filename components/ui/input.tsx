import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "min-h-[46px] w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-mut focus:border-p disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
