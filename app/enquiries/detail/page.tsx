"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPKR } from "@/lib/formatters";

function EnquiryDetailPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { data, loading, setEnquiryStatus, setBedState, mutating } = useHostel();

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const enquiry = data.enquiries.find((item) => item.id === params.get("id"));
  if (!enquiry) {
    return (
      <AppShell>
        <EmptyState
          title="Enquiry not found"
          description="This lead is no longer in the list."
        />
      </AppShell>
    );
  }

  const matches = data.rooms
    .filter((room) => room.type === enquiry.roomType)
    .map((room) => ({ room, free: room.beds.filter((bed) => bed.state === "vacant") }))
    .filter((entry) => entry.free.length > 0)
    .slice(0, 4);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader title="Enquiry" backHref="/enquiries" />

        <div className="rounded-3xl border border-line bg-white p-4">
          <p className="text-lg font-extrabold">{enquiry.name}</p>
          <p className="mt-1 text-xs font-semibold text-mut">
            {enquiry.phone} · {enquiry.source} · added {enquiry.createdAt}
          </p>
          <dl className="mt-3.5 flex flex-col gap-2.5 text-[12.5px]">
            <div className="flex justify-between">
              <dt className="font-semibold text-mut">Preferred room</dt>
              <dd className="font-bold">
                {enquiry.roomType === 4
                  ? "Four-seater · Rs 7,500"
                  : "Three-seater · Rs 9,000"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-mut">Expected joining</dt>
              <dd className="font-bold">{enquiry.expectedJoining}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-mut">Pipeline status</dt>
              <dd className="font-bold">{enquiry.status}</dd>
            </div>
            <div>
              <dt className="font-semibold text-mut">Notes</dt>
              <dd className="mt-1 font-semibold leading-relaxed">{enquiry.notes}</dd>
            </div>
          </dl>
        </div>

        <h2 className="text-[13px] font-extrabold">Matching vacant beds</h2>
        <div className="flex flex-col gap-2.5">
          {matches.length === 0 ? (
            <EmptyState
              title="No matching beds"
              description="Nothing vacant in this room type right now."
            />
          ) : (
            matches.map((entry) => (
              <div
                key={entry.room.no}
                className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-3.5"
              >
                <Link
                  href={"/rooms/detail?no=" + entry.room.no}
                  className="min-w-0 flex-1"
                >
                  <span className="block text-[13.5px] font-bold">
                    Room {entry.room.no} · Bed {entry.free[0].id}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-mut">
                    {entry.room.floor} · {entry.free.length} vacant ·{" "}
                    {formatPKR(entry.room.rent)}
                  </span>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={mutating}
                  onClick={async () => {
                    await setBedState(entry.room.no, entry.free[0].id, "held");
                    await setEnquiryStatus(enquiry.id, "Bed Held");
                  }}
                >
                  Hold bed
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            disabled={mutating}
            onClick={() => setEnquiryStatus(enquiry.id, "Visit Scheduled")}
          >
            Schedule visit
          </Button>
          <Button
            variant="outline"
            disabled={mutating}
            onClick={() => setEnquiryStatus(enquiry.id, "Visited")}
          >
            Mark visited
          </Button>
          <Button
            variant="ghost"
            disabled={mutating}
            onClick={() => setEnquiryStatus(enquiry.id, "Lost")}
          >
            Mark as lost
          </Button>
          <Button
            disabled={mutating}
            onClick={async () => {
              await setEnquiryStatus(enquiry.id, "Admitted");
              const query = new URLSearchParams({
                name: enquiry.name,
                phone: enquiry.phone,
                joining: enquiry.expectedJoining,
              });
              router.push("/admissions/new?" + query.toString());
            }}
          >
            Convert to admission
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

export default function EnquiryDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <EnquiryDetailPageContent />
    </Suspense>
  );
}
