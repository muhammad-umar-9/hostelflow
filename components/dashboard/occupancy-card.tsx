import Link from "next/link";
import type { OccupancyStats } from "@/lib/types";

export function OccupancyCard({ stats }: { stats: OccupancyStats }) {
  return (
    <Link
      href="/rooms"
      className="block rounded-3xl bg-p p-4 text-white transition hover:bg-pd"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-white/70">Occupancy today</span>
        <span className="text-xl font-extrabold">{stats.occupancyRate}%</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-white"
          style={{ width: stats.occupancyRate + "%" }}
        />
      </div>
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {[
          { value: stats.totalBeds, label: "Total beds" },
          { value: stats.occupied, label: "Occupied" },
          { value: stats.vacant, label: "Vacant" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-white/10 px-2.5 py-2">
            <p className="text-base font-extrabold">{item.value}</p>
            <p className="text-[10.5px] font-semibold text-white/70">{item.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-white/60">
        {stats.ready} ready to allot · {stats.held} held · {stats.maintenance} maintenance
      </p>
    </Link>
  );
}
