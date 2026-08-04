"use client";

import Link from "next/link";
import { AttentionList } from "@/components/dashboard/attention-list";
import { CollectionCard } from "@/components/dashboard/collection-card";
import { OccupancyCard } from "@/components/dashboard/occupancy-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/layout/error-state";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { DemoResetButton } from "@/components/layout/demo-reset-button";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { CURRENT_DATE } from "@/lib/constants";
import { getStats } from "@/lib/mock-data/selectors";

export default function DashboardPage() {
  const { data, loading, error, reload, role } = useHostel();

  return (
    <AppShell>
      {loading || !data ? (
        <LoadingScreen />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="flex flex-col gap-5">
          <PageHeader
            showBack={false}
            showBell
            title={data.settings.name}
            subtitle={
              (role === "owner" ? "Owner" : "Manager") +
              " · " +
              (role === "owner" ? "Full access" : "Front desk")
            }
          />
          <OccupancyCard stats={getStats(data)} />
          <CollectionCard stats={getStats(data)} />

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-extrabold tracking-tight">Quick actions</h2>
            <QuickActions />
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-extrabold tracking-tight">Attention required</h2>
              <span className="text-[11px] font-semibold text-mut">{CURRENT_DATE}</span>
            </div>
            <AttentionList stats={getStats(data)} />
          </section>

          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" asChild>
              <Link href="/enquiries">Walk-in enquiries</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/payments/proofs">Payment proofs</Link>
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 lg:hidden">
            <RoleSwitcher />
            <DemoResetButton />
          </div>
        </div>
      )}
    </AppShell>
  );
}
