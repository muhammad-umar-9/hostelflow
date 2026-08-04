"use client";

import { Suspense } from "react";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { PoliceStatusSheet } from "@/components/residents/police-status-sheet";
import { ResidentAvatar } from "@/components/residents/resident-avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceStatusBadge, PoliceStatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { formatPKR } from "@/lib/formatters";
import { getInvoice, getResident } from "@/lib/mock-data/selectors";

function ResidentProfilePageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { data, loading, recordCashPayment, mutating } = useHostel();
  const [policeOpen, setPoliceOpen] = React.useState(false);

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const id = params.get("id") || data.currentResidentId;
  const resident = getResident(data, id);
  if (!resident) {
    return (
      <AppShell>
        <EmptyState title="Resident not found" description="This profile is no longer available." />
      </AppShell>
    );
  }

  const invoice = getInvoice(data, resident.id);
  const outstanding = invoice ? Math.max(0, invoice.due - invoice.received) : 0;
  const receipts = data.receipts.filter((receipt) => receipt.residentId === resident.id);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader title="Resident profile" backHref="/residents" />

        <div className="rounded-3xl border border-line bg-white p-4">
          <div className="flex items-center gap-3">
            <ResidentAvatar
              initials={resident.initials}
              color={resident.color}
              className="h-14 w-14 rounded-[19px] text-lg"
            />
            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight">{resident.name}</p>
              <p className="mt-0.5 text-xs font-semibold text-mut">
                Room {resident.room} · Bed {resident.bed}
              </p>
              <p className="text-[11.5px] text-mut">
                {resident.roomType} · {formatPKR(resident.rent)} per month
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <InvoiceStatusBadge status={invoice ? invoice.status : "paid"} prefix="Rent:" />
            <PoliceStatusBadge stage={resident.police} prefix="Police:" />
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => toast("Calling " + resident.phone + " ...")}
            >
              Call
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => toast("Opening WhatsApp chat with " + resident.name)}
            >
              WhatsApp
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={mutating}
              onClick={async () => {
                if (outstanding <= 0) {
                  toast("August rent is already settled");
                  return;
                }
                await recordCashPayment(resident.id, outstanding);
              }}
            >
              Record payment
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <dl className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-4 text-[12.5px]">
              <Row label="CNIC" value={resident.cnic} mono />
              <Row label="WhatsApp" value={resident.phone} />
              <Row label="Institution" value={resident.institution} />
              <Row label="Joining date" value={resident.joined} />
              <Row label="Security held" value={formatPKR(resident.security)} />
              <Row
                label="Outstanding"
                value={formatPKR(outstanding) + (invoice ? " · due " + invoice.dueDate : "")}
              />
              <div className="h-px bg-line" />
              <Block label="Guardian">
                {resident.guardian.name} ({resident.guardian.relationship}) ·{" "}
                {resident.guardian.phone}
              </Block>
              <Block label="Emergency contact">
                {resident.emergency.name} · {resident.emergency.phone}
              </Block>
              <Block label="Permanent address">{resident.address}</Block>
            </dl>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                onClick={() => toast("Reminder sent to " + resident.name + " on WhatsApp")}
              >
                Send reminder
              </Button>
              <Button variant="outline" asChild>
                <Link href="/rooms?filter=vacant">Move room</Link>
              </Button>
              <Button variant="outline" onClick={() => setPoliceOpen(true)}>
                Update police status
              </Button>
              <Button
                variant="danger"
                onClick={() => router.push("/checkout?resident=" + resident.id)}
              >
                Start checkout
              </Button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-mut">
              Full CNIC digits are visible only inside this authorised profile. Managers cannot
              delete financial records.
            </p>
          </TabsContent>

          <TabsContent value="documents">
            <div className="flex flex-col gap-2.5">
              {([
                ["Resident photograph", resident.documents.photo],
                ["CNIC / B-Form front", resident.documents.cnicFront],
                ["CNIC / B-Form back", resident.documents.cnicBack],
                ["Guardian CNIC", resident.documents.guardianCnic],
              ] as [string, boolean][]).map(([label, uploaded]) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5"
                >
                  <span
                    className={
                      "flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold " +
                      (uploaded ? "bg-okt text-ok" : "bg-badt text-bad")
                    }
                  >
                    {uploaded ? "OK" : "—"}
                  </span>
                  <div>
                    <p className="text-[13px] font-bold">{label}</p>
                    <p
                      className={
                        "mt-0.5 text-[11px] font-bold " + (uploaded ? "text-ok" : "text-bad")
                      }
                    >
                      {uploaded ? "Uploaded" : "Missing"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="payments">
            <div className="flex flex-col gap-2.5">
              {receipts.length === 0 ? (
                <EmptyState
                  title="No receipts yet"
                  description="Receipts generated in this session appear here."
                />
              ) : (
                receipts.map((receipt) => (
                  <Link
                    key={receipt.id}
                    href={"/receipts/detail?id=" + receipt.id}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5"
                  >
                    <span className="flex-1">
                      <span className="block text-[12.5px] font-bold">{receipt.purpose}</span>
                      <span className="mt-0.5 block text-[11px] text-mut">{receipt.date}</span>
                    </span>
                    <span className="text-[13px] font-extrabold">{formatPKR(receipt.total)}</span>
                  </Link>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="flex flex-col gap-3.5 rounded-3xl border border-line bg-white p-4">
              {resident.activity.map((entry, index) => (
                <div key={index} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-p" />
                  <div>
                    <p className="text-[12.5px] font-bold leading-snug">{entry.title}</p>
                    <p className="mt-0.5 text-[11px] text-mut">{entry.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <PoliceStatusSheet
        residentId={resident.id}
        open={policeOpen}
        onOpenChange={setPoliceOpen}
      />
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

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-mut">{label}</dt>
      <dd className="mt-1 font-bold leading-relaxed">{children}</dd>
    </div>
  );
}

export default function ResidentProfilePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ResidentProfilePageContent />
    </Suspense>
  );
}
