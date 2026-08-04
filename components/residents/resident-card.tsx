import Link from "next/link";
import { InvoiceStatusBadge, PoliceStatusBadge } from "@/components/ui/status-badge";
import type { Invoice, Resident } from "@/lib/types";
import { ResidentAvatar } from "./resident-avatar";

export function ResidentCard({
  resident,
  invoice,
}: {
  resident: Resident;
  invoice?: Invoice;
}) {
  return (
    <Link
      href={"/residents/detail?id=" + resident.id}
      className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 transition hover:border-p/40"
    >
      <ResidentAvatar initials={resident.initials} color={resident.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{resident.name}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-mut">
          Room {resident.room} · Bed {resident.bed} · {resident.phone}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <InvoiceStatusBadge status={invoice ? invoice.status : "paid"} />
          <PoliceStatusBadge stage={resident.police} />
        </div>
      </div>
    </Link>
  );
}
