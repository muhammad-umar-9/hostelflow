"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useHostel } from "@/components/providers/hostel-provider";
import { ResidentAvatar } from "@/components/residents/resident-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScreenshotPlaceholder } from "@/components/payments/screenshot-placeholder";
import { FormError } from "./form-error";
import { StepProgress } from "./step-progress";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatPKR } from "@/lib/formatters";
import { getInvoice, getResident } from "@/lib/mock-data/selectors";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const TITLES = ["Dates and dues", "Damages and deductions", "Settlement"];

export function CheckoutWizard({ residentId }: { residentId: string }) {
  const router = useRouter();
  const { data, role, completeCheckout, mutating } = useHostel();
  const [step, setStep] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [allowDues, setAllowDues] = React.useState(false);
  const [leavingDate, setLeavingDate] = React.useState("12 Aug 2026");
  const [hasDamage, setHasDamage] = React.useState(false);
  const [damageAmount, setDamageAmount] = React.useState(500);
  const [damageNote, setDamageNote] = React.useState(
    "Broken cupboard handle and wall stains",
  );
  const [photos, setPhotos] = React.useState(0);
  const [otherCharges, setOtherCharges] = React.useState(0);
  const [refundMethod, setRefundMethod] = React.useState<PaymentMethod>("Cash");
  const [confirmed, setConfirmed] = React.useState(false);

  if (!data) return null;
  const resident = getResident(data, residentId);
  if (!resident) return <FormError message="Resident not found." />;

  const invoice = getInvoice(data, residentId);
  const unpaid = invoice ? Math.max(0, invoice.due - invoice.received) : 0;
  const damage = hasDamage ? damageAmount : 0;
  const deductions = unpaid + damage + otherCharges;
  const refund = resident.security - deductions;

  const next = async () => {
    setError(null);
    if (step === 1) {
      if (unpaid > 0 && !allowDues) {
        setError(
          formatPKR(unpaid) +
            " rent is still unpaid. It will be deducted from the security deposit.",
        );
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (!confirmed) {
      setError("Confirm the settlement amount before completing checkout.");
      return;
    }
    if (refund < 0 && role !== "owner") {
      setError(
        "Deductions exceed the security deposit. Owner approval is required — switch to the Owner role to continue.",
      );
      return;
    }
    const result = await completeCheckout(residentId, {
      leavingDate,
      damageAmount: damage,
      damageNote,
      otherCharges,
      refundMethod,
    });
    if (result.receiptId) router.push("/receipts/detail?id=" + result.receiptId);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11.5px] font-semibold text-mut">
          Step {step} of 3 · {TITLES[step - 1]}
        </p>
        <StepProgress step={step} total={3} />
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
        <ResidentAvatar initials={resident.initials} color={resident.color} />
        <div>
          <p className="text-sm font-extrabold">{resident.name}</p>
          <p className="mt-0.5 text-[11.5px] text-mut">
            Room {resident.room} · Bed {resident.bed}
          </p>
        </div>
      </div>

      <FormError message={error} />

      {step === 1 ? (
        <div className="flex flex-col gap-3">
          <Field label="Intended leaving date">
            <Input value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} />
          </Field>
          <dl className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 text-[13px]">
            <div className="flex justify-between">
              <dt className="font-semibold text-mut">Unpaid rent (August)</dt>
              <dd className="font-extrabold">{formatPKR(unpaid)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-mut">Security deposit held</dt>
              <dd className="font-extrabold">{formatPKR(resident.security)}</dd>
            </div>
          </dl>
          <Field label="Other outstanding charges">
            <Input
              inputMode="numeric"
              value={String(otherCharges)}
              onChange={(e) =>
                setOtherCharges(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)
              }
            />
          </Field>
          {unpaid > 0 && !allowDues ? (
            <Button
              variant="outline"
              onClick={() => {
                setAllowDues(true);
                setError(null);
                setStep(2);
              }}
            >
              Deduct unpaid rent from the deposit and continue
            </Button>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
            <Checkbox
              checked={hasDamage}
              onCheckedChange={(checked) => setHasDamage(checked === true)}
            />
            <span className="text-[13px] font-bold">
              Room or property damage recorded
            </span>
          </label>
          {hasDamage ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3.5">
              <Field label="Damage note">
                <Input
                  className="bg-canvas"
                  value={damageNote}
                  onChange={(e) => setDamageNote(e.target.value)}
                />
              </Field>
              <Field label="Deduction amount">
                <Input
                  className="bg-canvas"
                  inputMode="numeric"
                  value={String(damageAmount)}
                  onChange={(e) =>
                    setDamageAmount(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)
                  }
                />
              </Field>
              <button type="button" onClick={() => setPhotos((count) => count + 1)}>
                <ScreenshotPlaceholder
                  className="h-[110px]"
                  label={photos + " photos attached · tap to add"}
                />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-3">
          <dl className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-4 text-[13px]">
            <Row label="Security deposit held" value={formatPKR(resident.security)} />
            <Row label="Unpaid rent" value={formatPKR(unpaid)} />
            <Row label="Damage deduction" value={formatPKR(damage)} />
            <Row label="Other charges" value={formatPKR(otherCharges)} />
            <Row label="Total deductions" value={formatPKR(deductions)} />
            <div className="h-px bg-line" />
            <div className="flex items-baseline justify-between">
              <dt className="text-sm font-extrabold">Refundable amount</dt>
              <dd className="text-xl font-extrabold text-ok">
                {formatPKR(Math.max(0, refund))}
              </dd>
            </div>
            {refund < 0 ? (
              <p className="rounded-xl bg-badt p-3 text-[11.5px] font-bold leading-relaxed text-bad">
                Deductions exceed the deposit by {formatPKR(Math.abs(refund))}. Owner
                approval is required to complete this checkout.
              </p>
            ) : null}
          </dl>

          <p className="text-[11.5px] font-bold text-mut">Refund method</p>
          <div className="grid grid-cols-2 gap-2.5">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setRefundMethod(method)}
                className={cn(
                  "min-h-[46px] rounded-2xl border-2 px-3 py-3 text-[12.5px] font-bold transition",
                  refundMethod === method
                    ? "border-p bg-tint text-p"
                    : "border-line bg-white text-ink",
                )}
              >
                {method}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <span className="text-[12.5px] font-semibold leading-relaxed">
              The resident agrees to the settlement and has received the refund.
            </span>
          </label>
        </div>
      ) : null}

      <div className="print-hide fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/97 px-4 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-[560px] gap-2.5">
          <Button
            variant="outline"
            size="lg"
            onClick={() => (step === 1 ? router.back() : setStep(step - 1))}
          >
            Back
          </Button>
          <Button size="lg" className="flex-1" disabled={mutating} onClick={next}>
            {mutating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {step === 3 ? "Confirm checkout" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="font-semibold text-mut">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
