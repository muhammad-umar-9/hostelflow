import { formatPKR } from "@/lib/formatters";
import type { HostelSettings, Room } from "@/lib/types";

export function StepCharges({
  room,
  bedId,
  settings,
}: {
  room: Room;
  bedId: string;
  settings: HostelSettings;
}) {
  const total = room.rent + settings.security + settings.policeCharge;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl border border-line bg-white p-4">
        <p className="text-xs font-bold text-mut">
          Room {room.no} · Bed {bedId} ·{" "}
          {room.type === 4 ? "Four-seater" : "Three-seater"}
        </p>
        <dl className="mt-3.5 flex flex-col gap-3 text-[13.5px]">
          <div className="flex justify-between">
            <dt className="font-semibold">First month rent</dt>
            <dd className="font-bold">{formatPKR(room.rent)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold">
              Security deposit <span className="text-[11px] font-bold text-ok">refundable</span>
            </dt>
            <dd className="font-bold">{formatPKR(settings.security)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold">
              Police form charge <span className="text-[11px] font-semibold text-mut">one-time</span>
            </dt>
            <dd className="font-bold">{formatPKR(settings.policeCharge)}</dd>
          </div>
          <div className="h-px bg-line" />
          <div className="flex items-baseline justify-between">
            <dt className="text-sm font-extrabold">Total due today</dt>
            <dd className="text-xl font-extrabold text-p">{formatPKR(total)}</dd>
          </div>
        </dl>
      </div>
      <p className="text-[11.5px] leading-relaxed text-mut">
        Charges are calculated from the selected room type and the hostel settings. The
        security deposit is held separately and returned at checkout after any deductions.
      </p>
    </div>
  );
}
