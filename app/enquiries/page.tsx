"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { useHostel } from "@/components/providers/hostel-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { EnquiryStatus } from "@/lib/types";

const TONES: Record<EnquiryStatus, "primary" | "warning" | "success" | "neutral"> = {
  New: "primary",
  "Visit Scheduled": "warning",
  Visited: "warning",
  "Bed Held": "success",
  Admitted: "success",
  Lost: "neutral",
};

export default function EnquiriesPage() {
  const { data, loading } = useHostel();
  const [open, setOpen] = React.useState(false);

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Walk-in enquiries"
          subtitle={data.enquiries.length + " open leads"}
          backHref="/more"
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              + New
            </Button>
          }
        />

        {data.enquiries.length === 0 ? (
          <EmptyState
            title="No enquiries yet"
            description="Log a walk-in, WhatsApp or referral lead and track it to admission."
          />
        ) : (
          <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2">
            {data.enquiries.map((enquiry) => (
              <Link
                key={enquiry.id}
                href={"/enquiries/detail?id=" + enquiry.id}
                className="rounded-2xl border border-line bg-white p-3.5 transition hover:border-p/40"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{enquiry.name}</span>
                  <Badge tone={TONES[enquiry.status]}>{enquiry.status}</Badge>
                </span>
                <span className="mt-1 block text-[11.5px] text-mut">
                  {enquiry.phone} ·{" "}
                  {enquiry.roomType === 4 ? "Four-seater" : "Three-seater"} · from{" "}
                  {enquiry.expectedJoining}
                </span>
                <span className="mt-0.5 block text-[11px] text-mut">
                  Source: {enquiry.source}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle className="mb-3 text-base font-extrabold">New enquiry</SheetTitle>
          <EnquiryForm onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
