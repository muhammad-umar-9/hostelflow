"use client";

import { Suspense } from "react";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { ResidentCard } from "@/components/residents/resident-card";
import { ResidentSearch } from "@/components/residents/resident-search";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { getInvoice } from "@/lib/mock-data/selectors";

type Filter = "active" | "unpaid" | "police" | "checkout" | "former";

function ResidentsPageContent() {
  const params = useSearchParams();
  const { data, loading } = useHostel();
  const [filter, setFilter] = React.useState<Filter>(
    (params.get("filter") as Filter) || "active",
  );
  const [query, setQuery] = React.useState("");

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const term = query.trim().toLowerCase();
  const residents = data.residents
    .filter((resident) => {
      if (filter === "former") return resident.status === "former";
      if (resident.status !== "active") return false;
      if (filter === "unpaid") {
        const invoice = getInvoice(data, resident.id);
        return Boolean(
          invoice &&
            ["unpaid", "overdue", "partial"].includes(invoice.status),
        );
      }
      if (filter === "police") return resident.police !== "verified";
      if (filter === "checkout") return Boolean(resident.checkoutDate);
      return true;
    })
    .filter((resident) =>
      term
        ? (resident.name + " " + resident.cnic + " " + resident.phone + " " + resident.room)
            .toLowerCase()
            .includes(term)
        : true,
    );

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          showBack={false}
          title="Residents"
          subtitle={residents.length + (filter === "former" ? " former residents" : " residents")}
          action={
            <Button size="sm" asChild>
              <Link href="/admissions/new">+ Add</Link>
            </Button>
          }
        />
        <ResidentSearch value={query} onChange={setQuery} />
        <FilterChips
          value={filter}
          onChange={setFilter}
          chips={[
            { value: "active", label: "Active" },
            { value: "unpaid", label: "Unpaid rent" },
            { value: "police", label: "Police pending" },
            { value: "checkout", label: "Checkout soon" },
            { value: "former", label: "Former" },
          ]}
        />

        {residents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nothing here yet"
            description="No residents match this filter or search."
          />
        ) : (
          <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2">
            {residents.slice(0, 60).map((resident) => (
              <ResidentCard
                key={resident.id}
                resident={resident}
                invoice={getInvoice(data, resident.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ResidentsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ResidentsPageContent />
    </Suspense>
  );
}
