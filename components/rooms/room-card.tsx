import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPKR } from "@/lib/formatters";
import type { Room } from "@/lib/types";
import { BedChip } from "./bed-chip";

export function RoomCard({ room }: { room: Room }) {
  const occupied = room.beds.filter((bed) => bed.state === "occupied").length;
  const vacant = room.beds.filter((bed) => bed.state === "vacant").length;

  return (
    <Link
      href={"/rooms/detail?no=" + room.no}
      className="block rounded-2xl border border-line bg-white p-3.5 transition hover:border-p/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14.5px] font-extrabold">Room {room.no}</span>
        <Badge tone={vacant ? "success" : "neutral"}>
          {vacant ? vacant + " vacant" : "Full"}
        </Badge>
      </div>
      <p className="mt-1 text-[11.5px] font-semibold text-mut">
        {room.type === 4 ? "Four-seater" : "Three-seater"} · {formatPKR(room.rent)} / bed
        · {occupied}/{room.type} occupied
      </p>
      <div className="mt-2.5 flex gap-1.5">
        {room.beds.map((bed) => (
          <BedChip key={bed.id} id={bed.id} state={bed.state} />
        ))}
      </div>
    </Link>
  );
}
