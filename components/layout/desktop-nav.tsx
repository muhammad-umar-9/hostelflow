"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHostel } from "@/components/providers/hostel-provider";
import { navForRole } from "./nav-items";
import { RoleSwitcher } from "./role-switcher";
import { DemoResetButton } from "./demo-reset-button";
import { cn } from "@/lib/utils";

export function DesktopNav() {
  const pathname = usePathname();
  const { role, data } = useHostel();
  const items = navForRole(role);

  return (
    <aside className="print-hide sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-white p-4 lg:flex">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-p text-sm font-extrabold text-white">
          H
        </div>
        <div>
          <p className="text-sm font-extrabold tracking-tight">HostelFlow</p>
          <p className="text-[10px] text-mut">{data ? data.settings.name : "Loading"}</p>
        </div>
      </div>

      <nav className="mt-6 flex flex-col gap-1">
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active ? "bg-tint text-p" : "text-mut hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <RoleSwitcher />
        <DemoResetButton />
      </div>
    </aside>
  );
}
