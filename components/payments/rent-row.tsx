"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { InvoiceStatusBadge } from "@/components/ui/status-badge";
import { formatPKR } from "@/lib/formatters";
import type { Invoice, Resident } from "@/lib/types";

interface RentRowProps {
  invoice: Invoice;
  resident: Resident;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}

export function RentRow({
  invoice,
  resident,
  selectable = false,
  selected = false,
  onToggle,
}: RentRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
      {selectable ? (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle && onToggle()}
          aria-label={"Select " + resident.name}
        />
      ) : null}
      <Link href={"/residents/detail?id=" + resident.id} className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-bold text-ink">{resident.name}</span>
          <InvoiceStatusBadge status={invoice.status} />
        </span>
        <span className="mt-1 block truncate text-[11px] text-mut">
          Room {resident.room} · Bed {resident.bed} · due {invoice.dueDate}
        </span>
        <span className="mt-0.5 block text-[11px] text-mut">
          {invoice.received
            ? formatPKR(invoice.received) + " received"
            : "Nothing received"}
          {invoice.reminded ? " · Reminder sent" : ""}
        </span>
      </Link>
      <div className="shrink-0 text-right">
        <p className="text-sm font-extrabold">
          {formatPKR(invoice.due - invoice.received)}
        </p>
        <p className="text-[10px] font-semibold text-mut">of {formatPKR(invoice.due)}</p>
      </div>
    </div>
  );
}
