"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-p text-white hover:bg-pd",
        outline: "border border-line bg-white text-ink hover:bg-canvas",
        soft: "bg-tint text-p border border-p/20 hover:bg-tint/70",
        success: "bg-ok text-white hover:opacity-90",
        danger: "border border-bad/30 bg-badt text-bad hover:bg-badt/70",
        ghost: "text-mut hover:bg-canvas",
        link: "text-p underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] px-4 py-3",
        sm: "min-h-[38px] px-3 py-2 text-xs",
        lg: "min-h-[52px] px-5 py-4 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
