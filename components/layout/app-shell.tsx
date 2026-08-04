"use client";

import { BottomNav } from "./bottom-nav";
import { DesktopNav } from "./desktop-nav";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  /** Hide navigation for focused flows (admission, checkout, login). */
  bare?: boolean;
  className?: string;
}

export function AppShell({ children, bare = false, className }: AppShellProps) {
  if (bare) {
    return (
      <main className={cn("mx-auto w-full max-w-[560px] px-4 pb-32 pt-6", className)}>
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <DesktopNav />
      <div className="flex-1">
        <main
          className={cn(
            "mx-auto w-full max-w-[560px] px-4 pb-28 pt-6 lg:max-w-3xl lg:px-8 lg:pb-12 lg:pt-10",
            className,
          )}
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
