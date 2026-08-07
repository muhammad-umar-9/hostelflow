import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { OccupancyStats } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AttentionList({ stats }: { stats: OccupancyStats }) {
  const items = [
    {
      href: "/payments?filter=overdue",
      count: stats.unpaidResidents,
      label: "residents have unpaid rent",
      tone: "bg-badt text-bad",
    },
    {
      href: "/payments/proofs",
      count: stats.pendingProofs,
      label: "payment proofs need approval",
      tone: "bg-warnt text-warn",
    },
    {
      href: "/police-verification",
      count: stats.pendingPolice,
      label: "police forms are pending",
      tone: "bg-warnt text-warn",
    },
    {
      href: "/residents?filter=checkout",
      count: stats.leavingSoon,
      label: "residents are checking out soon",
      tone: "bg-tint text-p",
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3.5 py-3 transition hover:border-p/40"
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[15px] font-extrabold",
              item.tone,
            )}
          >
            {item.count}
          </span>
          <span className="flex-1 text-[13px] font-semibold leading-snug">
            {item.label}
          </span>
          <ChevronRight className="h-4 w-4 text-[#b6bcc6]" />
        </Link>
      ))}
    </div>
  );
}
