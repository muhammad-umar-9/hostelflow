"use client";

import * as React from "react";
import { BedChip } from "@/components/rooms/bed-chip";
import { FilterChips } from "@/components/ui/filter-chips";
import { formatPKR } from "@/lib/formatters";
import type { HostelData } from "@/lib/types";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | "3" | "4";

export function StepBed({
  data,
  roomNo,
  bedId,
  onSelect,
}: {
  data: HostelData;
  roomNo: string | null;
  bedId: string | null;
  onSelect: (roomNo: string, bedId: string) => void;
}) {
  const [filter, setFilter] = React.useState<TypeFilter>("all");
  const rooms = data.rooms
    .filter((room) => room.beds.some((bed) => bed.state === "vacant"))
    .filter((room) => filter === "all" || String(room.type) === filter);
  const selectedRoom = roomNo ? data.rooms.find((room) => room.no === roomNo) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <FilterChips
        value={filter}
        onChange={setFilter}
        chips={[
          { value: "all", label: "All types" },
          { value: "4", label: "Four-seater · Rs 7,500" },
          { value: "3", label: "Three-seater · Rs 9,000" },
        ]}
      />
      <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2">
        {rooms.map((room) => (
          <div
            key={room.no}
            className={cn(
              "rounded-2xl border p-3.5",
              roomNo === room.no ? "border-p bg-tint" : "border-line bg-white",
            )}
          >
            <p className="text-sm font-extrabold">Room {room.no}</p>
            <p className="mt-0.5 text-[11.5px] font-semibold text-mut">
              {room.floor} · {room.type === 4 ? "Four-seater" : "Three-seater"} ·{" "}
              {formatPKR(room.rent)}
            </p>
            <div className="mt-2.5 flex gap-1.5">
              {room.beds.map((bed) => (
                <BedChip
                  key={bed.id}
                  id={bed.id}
                  state={bed.state}
                  selected={roomNo === room.no && bedId === bed.id}
                  onClick={
                    bed.state === "vacant" ? () => onSelect(room.no, bed.id) : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-white p-3.5 text-[12.5px] font-bold">
        {selectedRoom && bedId
          ? "Room " + selectedRoom.no + " · Bed " + bedId + " · " +
            formatPKR(selectedRoom.rent) + " per month"
          : "No bed selected yet"}
      </div>
    </div>
  );
}
