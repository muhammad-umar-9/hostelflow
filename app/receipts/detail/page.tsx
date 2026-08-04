"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { ReceiptView } from "@/components/payments/receipt-view";
import { useHostel } from "@/components/providers/hostel-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { getResident } from "@/lib/mock-data/selectors";

function ReceiptDetailPageContent() {
  const params = useSearchParams();
  const { data, loading } = useHostel();

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const receipt = data.receipts.find((item) => item.id === params.get("id"));
  const resident = receipt ? getResident(data, receipt.residentId) : undefined;

  if (!receipt || !resident) {
    return (
      <AppShell>
        <EmptyState
          title="Receipt not found"
          description="Generate a receipt by admitting a resident, approving a payment or completing a checkout."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="print-hide">
          <PageHeader title="Receipt" backHref="/receipts" />
        </div>
        <ReceiptView receipt={receipt} resident={resident} settings={data.settings} />
      </div>
    </AppShell>
  );
}

export default function ReceiptDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ReceiptDetailPageContent />
    </Suspense>
  );
}
