"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHostel } from "@/components/providers/hostel-provider";
import { navForRole } from "./nav-items";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useHostel();
  const items = navForRole(role);

  return (
    <nav className="print-hide fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[520px] items-center px-1.5">
        {items.map((item) => {
          const active = item.match.some(
            (path) => pathname === path || pathname.startsWith(path + "/"),
          );
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-2",
                active ? "text-p" : "text-[#9aa1ac]",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} />
              <span className={cn("text-[10px]", active ? "font-bold" : "font-semibold")}>
                {item.label}
              </span>
              <span className="font-urdu text-[8px] leading-[2.1] opacity-75">
                {item.urdu}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
