"use client";

import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPKR } from "@/lib/formatters";
import { getResident } from "@/lib/mock-data/selectors";

export default function ReceiptsPage() {
  const { data, loading } = useHostel();
  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Receipts"
          subtitle={data.receipts.length + " generated in this session"}
          backHref="/payments"
        />
        {data.receipts.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No receipts yet"
            description="Admissions, approved payments and checkouts all generate receipts here."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {data.receipts.map((receipt) => {
              const resident = getResident(data, receipt.residentId);
              return (
                <Link
                  key={receipt.id}
                  href={"/receipts/detail?id=" + receipt.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">
                      {resident ? resident.name : receipt.residentId}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-mut">
                      {receipt.purpose} · {receipt.date}
                    </span>
                  </span>
                  <span className="text-[13px] font-extrabold">{formatPKR(receipt.total)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
