"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckoutWizard } from "@/components/forms/checkout-wizard";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { EmptyState } from "@/components/ui/empty-state";

function CheckoutContent() {
  const params = useSearchParams();
  const { data, loading } = useHostel();
  const residentId = params.get("resident");

  if (loading || !data) return <LoadingScreen />;
  if (!residentId) {
    return (
      <EmptyState
        title="Choose a resident first"
        description="Open a resident profile and tap Start checkout."
      />
    );
  }
  return <CheckoutWizard residentId={residentId} />;
}

export default function CheckoutPage() {
  return (
    <AppShell bare>
      <div className="flex flex-col gap-4">
        <PageHeader title="Checkout" subtitle="Settle dues and refund the deposit" />
        <Suspense fallback={<LoadingScreen />}>
          <CheckoutContent />
        </Suspense>
      </div>
    </AppShell>
  );
}
