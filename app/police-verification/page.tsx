"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { Badge } from "@/components/ui/badge";
import { POLICE_STAGE_LABELS } from "@/lib/constants";
import { maskCnic } from "@/lib/formatters";
import type { PoliceStage } from "@/lib/types";

const STAGES: PoliceStage[] = [
  "not_started",
  "incomplete",
  "prepared",
  "submitted",
  "verified",
  "rejected",
];

export default function PoliceVerificationPage() {
  const { data, loading } = useHostel();
  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const active = data.residents.filter((resident) => resident.status === "active");
  const pending = active.filter((resident) => resident.police !== "verified").length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Police verification"
          subtitle={pending + " residents still pending"}
          backHref="/more"
        />
        <p className="rounded-2xl bg-warnt px-3.5 py-3 text-[11.5px] font-semibold leading-relaxed text-warn">
          The Rs 300 police-form charge is collected at admission. It does not mean
          verification is complete.
        </p>

        {STAGES.map((stage) => {
          const rows = active.filter((resident) => resident.police === stage);
          if (rows.length === 0) return null;
          return (
            <section key={stage} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-extrabold">
                  {POLICE_STAGE_LABELS[stage]}
                </h2>
                <Badge tone={stage === "verified" ? "success" : "warning"}>
                  {rows.length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
                {rows.slice(0, 12).map((resident) => (
                  <Link
                    key={resident.id}
                    href={"/residents/detail?id=" + resident.id}
                    className="rounded-2xl border border-line bg-white p-3.5"
                  >
                    <span className="block text-[13px] font-bold">{resident.name}</span>
                    <span className="mt-1 block font-mono text-[11px] text-mut">
                      {maskCnic(resident.cnic)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-mut">
                      Room {resident.room} · joined {resident.joined}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-mut">
                      {resident.missingDocument
                        ? "Missing: " + resident.missingDocument
                        : "All documents on file"}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
