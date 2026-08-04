"use client";

import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { ProofCard } from "@/components/payments/proof-card";
import { useHostel } from "@/components/providers/hostel-provider";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPKR } from "@/lib/formatters";
import { getResident } from "@/lib/mock-data/selectors";

export default function ProofsPage() {
  const { data, loading } = useHostel();
  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const pending = data.proofs.filter((proof) => proof.status === "pending");
  const resolved = data.proofs.filter((proof) => proof.status !== "pending");

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Payment proofs"
          subtitle={pending.length + " waiting for review"}
          backHref="/payments"
        />

        {pending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Approval queue is clear"
            description="New screenshots from residents will appear here."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {pending.map((proof) => {
              const resident = getResident(data, proof.residentId);
              if (!resident) return null;
              return <ProofCard key={proof.id} proof={proof} resident={resident} />;
            })}
          </div>
        )}

        {resolved.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-extrabold">Reviewed</h2>
            {resolved.map((proof) => {
              const resident = getResident(data, proof.residentId);
              return (
                <div
                  key={proof.id}
                  className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-3.5 opacity-80"
                >
                  <span className="flex-1 text-[13px] font-bold">
                    {resident ? resident.name : proof.residentId}
                  </span>
                  <Badge tone={proof.status === "approved" ? "success" : "danger"}>
                    {proof.status === "approved" ? "Approved" : "Rejected"}
                  </Badge>
                  <span className="text-[13px] font-bold">{formatPKR(proof.amount)}</span>
                </div>
              );
            })}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
