import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { formatPKR } from "@/lib/formatters";
import type { OccupancyStats } from "@/lib/types";

export function CollectionCard({ stats }: { stats: OccupancyStats }) {
  return (
    <Link
      href="/payments"
      className="block rounded-3xl border border-line bg-white p-4 transition hover:border-p/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold">August rent collection</span>
        <span className="text-xs font-bold text-ok">{stats.collectedPercent}%</span>
      </div>
      <Progress value={stats.collectedPercent} className="mt-3" />
      <div className="mt-3.5 grid grid-cols-3 gap-2.5">
        <div>
          <p className="text-[10.5px] font-semibold text-mut">Expected</p>
          <p className="mt-0.5 text-sm font-bold">{formatPKR(stats.expected)}</p>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold text-mut">Collected</p>
          <p className="mt-0.5 text-sm font-bold text-ok">{formatPKR(stats.collected)}</p>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold text-mut">Outstanding</p>
          <p className="mt-0.5 text-sm font-bold text-bad">{formatPKR(stats.outstanding)}</p>
        </div>
      </div>
    </Link>
  );
}
