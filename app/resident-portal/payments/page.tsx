"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { PaySheet } from "@/components/resident/pay-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatusBadge } from "@/components/ui/status-badge";
import { formatPKR } from "@/lib/formatters";
import { getInvoice, getResident } from "@/lib/mock-data/selectors";

export default function ResidentPaymentsPage() {
  const { data, loading } = useHostel();
  const [payOpen, setPayOpen] = React.useState(false);

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const resident = getResident(data, data.currentResidentId);
  if (!resident) return null;
  const invoice = getInvoice(data, resident.id);
  const due = invoice ? Math.max(0, invoice.due - invoice.received) : 0;
  const receipts = data.receipts.filter((receipt) => receipt.residentId === resident.id);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader showBack={false} title="My payments" />
        <dl className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-4 text-[13px]">
          <div className="flex justify-between">
            <dt className="font-semibold text-mut">August rent due</dt>
            <dd className="font-extrabold">{formatPKR(due)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-semibold text-mut">Status</dt>
            <dd>
              <InvoiceStatusBadge status={invoice ? invoice.status : "paid"} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-mut">Security deposit</dt>
            <dd className="font-bold">{formatPKR(resident.security)}</dd>
          </div>
        </dl>
        <Button size="lg" onClick={() => setPayOpen(true)}>
          Submit payment proof
        </Button>

        <h2 className="text-[13px] font-extrabold">Receipts</h2>
        {receipts.length === 0 ? (
          <EmptyState
            title="No receipts yet"
            description="Receipts appear here once the manager verifies a payment."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {receipts.map((receipt) => (
              <Link
                key={receipt.id}
                href={"/receipts/detail?id=" + receipt.id}
                className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold">
                    {receipt.purpose}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-mut">
                    {receipt.date}
                  </span>
                </span>
                <span className="text-[13px] font-extrabold">
                  {formatPKR(receipt.total)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <PaySheet residentId={resident.id} open={payOpen} onOpenChange={setPayOpen} />
    </AppShell>
  );
}
