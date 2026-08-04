"use client";

import { Suspense } from "react";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { BedActionSheet } from "@/components/rooms/bed-action-sheet";
import { ResidentAvatar } from "@/components/residents/resident-avatar";
import { BedStateBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPKR } from "@/lib/formatters";
import { getResident } from "@/lib/mock-data/selectors";
import type { Bed } from "@/lib/types";

function RoomDetailPageContent() {
  const params = useSearchParams();
  const roomNo = params.get("no") || "101";
  const { data, loading } = useHostel();
  const [selectedBed, setSelectedBed] = React.useState<Bed | null>(null);

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const room = data.rooms.find((item) => item.no === roomNo);
  if (!room) {
    return (
      <AppShell>
        <EmptyState
          title="Room not found"
          description="This room number is not part of the hostel."
        />
      </AppShell>
    );
  }

  const occupied = room.beds.filter((bed) => bed.state === "occupied").length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={"Room " + room.no}
          subtitle={room.floor + " · " + (room.type === 4 ? "Four-seater" : "Three-seater")}
          backHref="/rooms"
        />

        <div className="flex gap-3 rounded-3xl border border-line bg-white p-4">
          <div className="flex-1">
            <p className="text-[10.5px] font-bold text-mut">RENT PER BED</p>
            <p className="mt-1 text-[17px] font-extrabold">{formatPKR(room.rent)}</p>
            <p className="mt-0.5 text-[11px] text-mut">per month</p>
          </div>
          <div className="w-px bg-line" />
          <div className="flex-1">
            <p className="text-[10.5px] font-bold text-mut">STATUS</p>
            <p className="mt-1.5 text-[13px] font-bold leading-snug">
              {occupied} of {room.type} beds occupied
            </p>
          </div>
        </div>

        <h2 className="text-[13px] font-extrabold">Bed layout</h2>
        <div className="flex flex-col gap-2.5">
          {room.beds.map((bed) => {
            const resident = bed.residentId ? getResident(data, bed.residentId) : undefined;
            const className =
              "flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-left transition hover:border-p/40";
            const body = (
              <>
                {resident ? (
                  <ResidentAvatar initials={resident.initials} color={resident.color} />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#b6bcc6] text-sm font-bold text-white">
                    {bed.id}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-extrabold">Bed {bed.id}</span>
                    <BedStateBadge state={bed.state} />
                  </span>
                  <span className="mt-1 block truncate text-[12.5px] font-semibold">
                    {resident
                      ? resident.name
                      : bed.state === "held"
                        ? "Held for a visitor"
                        : bed.state === "maintenance"
                          ? "Bed under maintenance"
                          : "No resident assigned"}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-mut">
                    {resident
                      ? resident.institution + " · joined " + resident.joined
                      : bed.state === "vacant"
                        ? formatPKR(room.rent) + " per month"
                        : ""}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#b6bcc6]" />
              </>
            );
            return resident ? (
              <Link
                key={bed.id}
                href={"/residents/detail?id=" + resident.id}
                className={className}
              >
                {body}
              </Link>
            ) : (
              <button
                key={bed.id}
                type="button"
                className={className}
                onClick={() => setSelectedBed(bed)}
              >
                {body}
              </button>
            );
          })}
        </div>
        <p className="text-[11.5px] leading-relaxed text-mut">
          Tap an occupied bed to open the resident. Tap a vacant, held or maintenance bed for
          allocation options.
        </p>
      </div>

      <BedActionSheet
        roomNo={room.no}
        bed={selectedBed}
        onOpenChange={(open) => {
          if (!open) setSelectedBed(null);
        }}
      />
    </AppShell>
  );
}

export default function RoomDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RoomDetailPageContent />
    </Suspense>
  );
}
