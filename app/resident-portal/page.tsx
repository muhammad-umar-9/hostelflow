"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { useHostel } from "@/components/providers/hostel-provider";
import { PaySheet } from "@/components/resident/pay-sheet";
import { ResidentAvatar } from "@/components/residents/resident-avatar";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge, PoliceStatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { formatPKR } from "@/lib/formatters";
import { getInvoice, getResident } from "@/lib/mock-data/selectors";

export default function ResidentHomePage() {
  const { data, loading, addMaintenanceRequest } = useHostel();
  const { toast } = useToast();
  const [payOpen, setPayOpen] = React.useState(false);

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const resident = getResident(data, data.currentResidentId);
  if (!resident) return null;
  const invoice = getInvoice(data, resident.id);
  const due = invoice ? Math.max(0, invoice.due - invoice.received) : 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ResidentAvatar initials={resident.initials} color={resident.color} />
            <div>
              <p className="text-[17px] font-extrabold tracking-tight">{resident.name}</p>
              <p className="text-[11.5px] font-semibold text-mut">
                Room {resident.room} · Bed {resident.bed}
              </p>
            </div>
          </div>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white"
          >
            <Bell className="h-[18px] w-[18px]" />
          </Link>
        </div>

        <div className="rounded-3xl bg-p p-4 text-white">
          <p className="text-xs font-semibold text-white/70">August rent</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{formatPKR(due)}</p>
          <p className="mt-1 text-xs text-white/70">
            Due on {invoice ? invoice.dueDate : "05 Aug 2026"} · {resident.roomType} ·{" "}
            {formatPKR(resident.rent)} per month
          </p>
          <Button
            size="lg"
            className="mt-3.5 w-full bg-white text-p hover:bg-white/90"
            onClick={() => setPayOpen(true)}
          >
            Pay or submit payment proof
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-line bg-white p-3.5">
            <p className="text-[10.5px] font-bold text-mut">RENT STATUS</p>
            <div className="mt-2">
              <InvoiceStatusBadge status={invoice ? invoice.status : "paid"} />
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-3.5">
            <p className="text-[10.5px] font-bold text-mut">POLICE FORM</p>
            <div className="mt-2">
              <PoliceStatusBadge stage={resident.police} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-line bg-white p-3.5">
          <span className="text-[12.5px] font-semibold text-mut">
            Security deposit held
          </span>
          <span className="text-[15px] font-extrabold">
            {formatPKR(resident.security)}
          </span>
        </div>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[13px] font-extrabold">Notices</h2>
          {data.notices.map((notice) => (
            <div
              key={notice.title}
              className="rounded-2xl border border-line bg-white p-3.5"
            >
              <p className="text-[12.5px] font-bold leading-snug">{notice.title}</p>
              <p className="mt-1 text-[11px] text-mut">{notice.date}</p>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            onClick={() => toast("Opening WhatsApp chat with the hostel manager")}
          >
            Contact manager
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              addMaintenanceRequest(resident.id, "Water leakage under the sink")
            }
          >
            Maintenance request
          </Button>
        </div>
      </div>

      <PaySheet residentId={resident.id} open={payOpen} onOpenChange={setPayOpen} />
    </AppShell>
  );
}
