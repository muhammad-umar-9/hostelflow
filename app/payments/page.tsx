"use client";

import { Suspense } from "react";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { ReminderDialog } from "@/components/payments/reminder-dialog";
import { RentRow } from "@/components/payments/rent-row";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { getResident } from "@/lib/mock-data/selectors";

type Filter = "all" | "overdue" | "proof" | "partial" | "paid";

function PaymentsPageContent() {
  const params = useSearchParams();
  const { data, loading } = useHostel();
  const [filter, setFilter] = React.useState<Filter>(
    (params.get("filter") as Filter) || "all",
  );
  const [selected, setSelected] = React.useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const rows = data.invoices
    .filter((invoice) => {
      if (filter === "all") return true;
      if (filter === "overdue") return invoice.status === "unpaid" || invoice.status === "overdue";
      if (filter === "proof") return invoice.status === "proof";
      if (filter === "partial") return invoice.status === "partial";
      return invoice.status === "paid";
    })
    .map((invoice) => ({ invoice, resident: getResident(data, invoice.residentId) }))
    .filter((row) => Boolean(row.resident));

  const selectable = filter === "overdue";

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          showBack={false}
          title="Monthly rent"
          subtitle={"August 2026 · " + rows.length + " residents"}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/payments/proofs">Proofs</Link>
            </Button>
          }
        />
        <FilterChips
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setSelected([]);
          }}
          chips={[
            { value: "all", label: "All" },
            { value: "overdue", label: "Unpaid and overdue" },
            { value: "proof", label: "Proof submitted" },
            { value: "partial", label: "Partial" },
            { value: "paid", label: "Paid" },
          ]}
        />

        {selectable ? (
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(rows.map((row) => row.invoice.residentId))}
            >
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
            <span className="text-[11.5px] font-bold text-mut">{selected.length} selected</span>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing outstanding here"
            description="Every resident in this filter is settled for August."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <RentRow
                key={row.invoice.id}
                invoice={row.invoice}
                resident={row.resident!}
                selectable={selectable}
                selected={selected.includes(row.invoice.residentId)}
                onToggle={() =>
                  setSelected((current) =>
                    current.includes(row.invoice.residentId)
                      ? current.filter((id) => id !== row.invoice.residentId)
                      : current.concat(row.invoice.residentId),
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 ? (
        <div className="print-hide fixed inset-x-0 bottom-[72px] z-30 border-t border-line bg-white/97 px-4 py-3 backdrop-blur lg:bottom-0">
          <div className="mx-auto flex max-w-[560px] items-center gap-2.5">
            <span className="flex-1 text-xs font-bold">
              {selected.length} residents selected
            </span>
            <Button variant="success" onClick={() => setPreviewOpen(true)}>
              Preview reminder
            </Button>
          </div>
        </div>
      ) : null}

      <ReminderDialog
        residentIds={selected}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onSent={() => setSelected([])}
      />
    </AppShell>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PaymentsPageContent />
    </Suspense>
  );
}
