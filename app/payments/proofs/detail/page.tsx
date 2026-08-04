"use client";

import { Suspense } from "react";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { ScreenshotPlaceholder } from "@/components/payments/screenshot-placeholder";
import { useHostel } from "@/components/providers/hostel-provider";
import { ResidentAvatar } from "@/components/residents/resident-avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatPKR } from "@/lib/formatters";
import { getResident } from "@/lib/mock-data/selectors";

const REASONS = [
  "Screenshot is not readable",
  "Amount does not match the invoice",
  "Transaction reference not found",
  "Payment belongs to another month",
];

function ProofDetailPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { data, loading, approveProof, rejectProof, mutating } = useHostel();
  const [rejectOpen, setRejectOpen] = React.useState(false);

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const proof = data.proofs.find((item) => item.id === params.get("id"));
  const resident = proof ? getResident(data, proof.residentId) : undefined;
  if (!proof || !resident) {
    return (
      <AppShell>
        <EmptyState
          title="Proof not found"
          description="This payment proof has already been reviewed."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-3.5 pb-24">
        <PageHeader title="Review payment proof" backHref="/payments/proofs" />

        <div className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4">
          <ResidentAvatar initials={resident.initials} color={resident.color} />
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold">{resident.name}</p>
            <p className="mt-0.5 text-[11.5px] text-mut">
              Room {resident.room} · Bed {resident.bed} · {resident.phone}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-white p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold text-mut">AMOUNT CLAIMED</span>
            <span className="text-xl font-extrabold text-p">{formatPKR(proof.amount)}</span>
          </div>
          <div className="my-3.5 h-px bg-line" />
          <dl className="flex flex-col gap-2.5 text-[12.5px]">
            <Row label="Billing month" value={proof.month} />
            <Row label="Method" value={proof.method} />
            <Row label="Reference" value={proof.reference} mono />
            <Row label="Sender" value={proof.sender} />
            <Row label="Submitted" value={proof.submittedAt} />
          </dl>
        </div>

        <div className="rounded-3xl border border-line bg-white p-4">
          <p className="text-[12.5px] font-extrabold">Screenshot</p>
          <ScreenshotPlaceholder
            className="mt-2.5 h-[230px]"
            label="payment screenshot sent by the resident"
          />
        </div>
      </div>

      <div className="print-hide fixed inset-x-0 bottom-[72px] z-30 border-t border-line bg-white/97 px-4 py-3 backdrop-blur lg:bottom-0">
        <div className="mx-auto flex max-w-[560px] flex-col gap-2.5">
          <div className="flex gap-2.5">
            <Button variant="danger" onClick={() => setRejectOpen(true)} disabled={mutating}>
              Reject
            </Button>
            <Button
              variant="success"
              className="flex-1"
              disabled={mutating}
              onClick={async () => {
                await approveProof(proof.id, proof.amount);
                router.push("/payments/proofs");
              }}
            >
              {mutating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Approve payment
            </Button>
          </div>
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={mutating}
              onClick={async () => {
                await approveProof(proof.id, Math.round(proof.amount / 2));
                router.push("/payments/proofs");
              }}
            >
              Mark as partial
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={mutating}
              onClick={async () => {
                await rejectProof(proof.id, "Screenshot is not readable");
                router.push("/payments/proofs");
              }}
            >
              Request clearer shot
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={rejectOpen} onOpenChange={setRejectOpen}>
        <SheetContent>
          <SheetTitle className="text-base font-extrabold">
            Why is this being rejected?
          </SheetTitle>
          <SheetDescription className="mt-1 text-xs leading-relaxed text-mut">
            A reason is required. The invoice stays unpaid and the resident is notified.
          </SheetDescription>
          <div className="mt-4 flex flex-col gap-2">
            {REASONS.map((reason) => (
              <Button
                key={reason}
                variant="outline"
                size="lg"
                className="justify-start"
                onClick={async () => {
                  setRejectOpen(false);
                  await rejectProof(proof.id, reason);
                  router.push("/payments/proofs");
                }}
              >
                {reason}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="font-semibold text-mut">{label}</dt>
      <dd className={mono ? "text-right font-mono text-[12px]" : "text-right font-bold"}>{value}</dd>
    </div>
  );
}

export default function ProofDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ProofDetailPageContent />
    </Suspense>
  );
}
