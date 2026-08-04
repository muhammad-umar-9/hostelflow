"use client";

import { Suspense } from "react";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { RoomCard } from "@/components/rooms/room-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { FLOORS } from "@/lib/constants";

type RoomFilter = "all" | "3" | "4" | "vacant" | "full";
type FloorFilter = "all" | "G" | "1" | "2" | "3";

function RoomsPageContent() {
  const params = useSearchParams();
  const { data, loading } = useHostel();
  const [filter, setFilter] = React.useState<RoomFilter>(
    (params.get("filter") as RoomFilter) || "all",
  );
  const [floor, setFloor] = React.useState<FloorFilter>("all");

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const groups = FLOORS.filter((item) => floor === "all" || floor === item.key)
    .map((item) => ({
      name: item.name,
      rooms: data.rooms
        .filter((room) => room.floor === item.name)
        .filter((room) => {
          const vacant = room.beds.filter((bed) => bed.state === "vacant").length;
          if (filter === "3") return room.type === 3;
          if (filter === "4") return room.type === 4;
          if (filter === "vacant") return vacant > 0;
          if (filter === "full") return vacant === 0;
          return true;
        }),
    }))
    .filter((group) => group.rooms.length > 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader title="Rooms and beds" urdu="کمرے اور بستر" backHref="/dashboard" />
        <FilterChips
          value={filter}
          onChange={setFilter}
          chips={[
            { value: "all", label: "All rooms" },
            { value: "3", label: "Three-seater" },
            { value: "4", label: "Four-seater" },
            { value: "vacant", label: "Has vacant bed" },
            { value: "full", label: "Fully occupied" },
          ]}
        />
        <FilterChips
          variant="soft"
          value={floor}
          onChange={setFloor}
          chips={[
            { value: "all", label: "All floors" },
            { value: "G", label: "Ground" },
            { value: "1", label: "First" },
            { value: "2", label: "Second" },
            { value: "3", label: "Third" },
          ]}
        />

        {groups.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No rooms match these filters"
            description="Try clearing the floor filter or switching back to all rooms."
          />
        ) : null}

        {groups.map((group) => (
          <section key={group.name} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-extrabold">{group.name}</h2>
              <span className="text-[11px] font-semibold text-mut">
                {group.rooms.length} rooms
              </span>
            </div>
            <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2 lg:grid-cols-3">
              {group.rooms.map((room) => (
                <RoomCard key={room.no} room={room} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

export default function RoomsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RoomsPageContent />
    </Suspense>
  );
}
