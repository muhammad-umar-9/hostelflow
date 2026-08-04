"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPKR } from "@/lib/formatters";
import type { HostelSettings, Room } from "@/lib/types";
import { admissionPaymentStatus } from "./step-payment";
import type { AdmissionState } from "./types";

export function StepReview({
  state,
  room,
  settings,
  onEdit,
  onConsentChange,
}: {
  state: AdmissionState;
  room: Room;
  settings: HostelSettings;
  onEdit: (step: number) => void;
  onConsentChange: (value: boolean) => void;
}) {
  const total = room.rent + settings.security + settings.policeCharge;
  const uploaded = Object.values(state.documents).filter(Boolean).length;
  const status = admissionPaymentStatus(state.payment);

  return (
    <div className="flex flex-col gap-2.5">
      <Section title="Resident" onEdit={() => onEdit(1)}>
        <p className="text-[13.5px] font-bold">{state.personal.name}</p>
        <p className="mt-1 text-xs leading-relaxed text-mut">
          {state.personal.cnic} · {state.personal.phone}
          <br />
          {state.personal.institution} · joining {state.personal.joining}
        </p>
      </Section>

      <Section title="Guardian and documents" onEdit={() => onEdit(2)}>
        <p className="text-[12.5px] leading-relaxed text-mut">
          {state.guardian.guardianName} ({state.guardian.relationship}) ·{" "}
          {state.guardian.guardianPhone}
          <br />
          Documents: {uploaded} of 5 uploaded
        </p>
      </Section>

      <Section title="Allocation" onEdit={() => onEdit(4)}>
        <p className="text-[13px] font-bold">
          Room {room.no} · Bed {state.bedId}
        </p>
        <p className="mt-1 text-xs text-mut">
          {room.type === 4 ? "Four-seater" : "Three-seater"} · {formatPKR(room.rent)} per month
        </p>
      </Section>

      <Section title="Charges and payment" onEdit={() => onEdit(6)}>
        <dl className="flex flex-col gap-2 text-[12.5px]">
          <Line label="Total charges" value={formatPKR(total)} />
          <Line
            label={"Received via " + (state.payment.method || "not selected")}
            value={formatPKR(state.payment.amount)}
          />
          <Line
            label="Remaining balance"
            value={formatPKR(Math.max(0, total - state.payment.amount))}
          />
          <div className="flex items-center justify-between">
            <dt className="font-semibold text-mut">Payment status</dt>
            <dd>
              <Badge
                tone={
                  status === "Verified"
                    ? "success"
                    : status === "Under Review"
                      ? "warning"
                      : "neutral"
                }
              >
                {status}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-semibold text-mut">Police verification</dt>
            <dd>
              <Badge tone="warning">Pending</Badge>
            </dd>
          </div>
        </dl>
      </Section>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
        <Checkbox
          checked={state.consent}
          onCheckedChange={(checked) => onConsentChange(checked === true)}
        />
        <span className="text-[12.5px] font-semibold leading-relaxed">
          The resident has read the hostel rules and agrees to the rent, security deposit and
          notice terms.
        </span>
      </label>
    </div>
  );
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-extrabold">{title}</p>
        <Button variant="link" size="sm" type="button" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="font-semibold text-mut">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
