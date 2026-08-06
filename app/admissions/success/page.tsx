"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { useHostel } from "@/components/providers/hostel-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatPKR } from "@/lib/formatters";
import { getResident } from "@/lib/mock-data/selectors";

function SuccessContent() {
  const params = useSearchParams();
  const { data } = useHostel();
  const { toast } = useToast();
  if (!data) return <LoadingScreen />;

  const resident = getResident(data, params.get("resident") || "");
  // Not a loading state: with no `?resident=` there is nothing still to load, and
  // returning LoadingScreen left the page spinning forever with no text and no way out —
  // which is what a bookmarked, refreshed or shared link produced. Every other detail
  // screen already answers a missing record with an EmptyState; this one now matches.
  if (!resident) {
    return (
      <EmptyState
        title="Admission not found"
        description="Open this page from the end of the admission wizard, or find the resident in the directory."
      />
    );
  }

  const amount = Number(params.get("amount") || 0);
  const balance = Number(params.get("balance") || 0);
  const status = params.get("status") || "Verified";
  const receiptId = params.get("receipt") || "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-16 w-16 animate-fade-up items-center justify-center rounded-3xl bg-okt">
        <Check className="h-8 w-8 text-ok" strokeWidth={2.6} />
      </div>
      <div>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
          Resident admitted successfully
        </h1>
        <p className="mt-2 font-urdu text-xs leading-[2.4] text-mut">
          رہائشی کامیابی سے داخل ہو گیا
        </p>
      </div>

      <div className="rounded-3xl border border-line bg-white p-4">
        <p className="text-lg font-extrabold">{resident.name}</p>
        <p className="mt-1 text-xs font-semibold text-mut">
          Room {resident.room} · Bed {resident.bed} · {resident.roomType} ·{" "}
          {formatPKR(resident.rent)} per month
        </p>
        <div className="my-3.5 h-px bg-line" />
        <dl className="flex flex-col gap-2.5 text-[13px]">
          <div className="flex justify-between">
            <dt className="font-semibold text-mut">Amount received</dt>
            <dd className="font-extrabold">{formatPKR(amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-mut">Remaining balance</dt>
            <dd className="font-extrabold">{formatPKR(balance)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-semibold text-mut">Payment status</dt>
            <dd>
              <Badge tone={status === "Verified" ? "success" : "warning"}>{status}</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-semibold text-mut">Police verification</dt>
            <dd>
              <Badge tone="warning">Pending</Badge>
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button size="lg" asChild>
          <Link href={"/receipts/detail?id=" + receiptId}>Download receipt</Link>
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" asChild>
            <Link href={"/residents/detail?id=" + resident.id}>View resident</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => toast("Receipt sent to " + resident.phone + " on WhatsApp")}
          >
            Share on WhatsApp
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admissions/new">Add another</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdmissionSuccessPage() {
  return (
    <AppShell bare>
      <Suspense fallback={<LoadingScreen />}>
        <SuccessContent />
      </Suspense>
    </AppShell>
  );
}
