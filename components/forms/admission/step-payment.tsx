"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScreenshotPlaceholder } from "@/components/payments/screenshot-placeholder";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { AdmissionPayment } from "./types";

export function StepPayment({
  payment,
  onChange,
}: {
  payment: AdmissionPayment;
  onChange: (patch: Partial<AdmissionPayment>) => void;
}) {
  const isCash = payment.method === "Cash";
  const isDigital = Boolean(payment.method) && !isCash;
  const status = isCash
    ? payment.cashConfirmed
      ? "Verified"
      : "Awaiting Payment"
    : payment.proofAttached
      ? "Under Review"
      : "Awaiting Payment";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11.5px] font-bold text-mut">Payment method</p>
      <div className="grid grid-cols-2 gap-2.5">
        {PAYMENT_METHODS.map((method: PaymentMethod) => (
          <button
            key={method}
            type="button"
            onClick={() => onChange({ method })}
            className={cn(
              "min-h-[48px] rounded-2xl border-2 px-3 py-3 text-[13px] font-bold transition",
              payment.method === method
                ? "border-p bg-tint text-p"
                : "border-line bg-white text-ink hover:border-p/40",
            )}
          >
            {method}
          </button>
        ))}
      </div>

      <Field label="Amount received">
        <Input
          inputMode="numeric"
          value={String(payment.amount)}
          onChange={(event) =>
            onChange({
              amount: Number(event.target.value.replace(/[^0-9]/g, "")) || 0,
            })
          }
        />
      </Field>

      {isDigital ? (
        <div className="rounded-2xl border border-line bg-white p-3.5">
          <p className="text-[12.5px] font-extrabold">Payment proof</p>
          <button
            type="button"
            className="mt-2.5 w-full"
            onClick={() => onChange({ proofAttached: !payment.proofAttached })}
          >
            <ScreenshotPlaceholder
              className="h-[150px]"
              label={
                payment.proofAttached
                  ? "payment screenshot attached — tap to remove"
                  : "no screenshot attached — tap to attach"
              }
            />
          </button>
          <div className="mt-3 flex flex-col gap-2.5">
            <Field label="Transaction / reference ID">
              <Input
                className="bg-canvas font-mono"
                value={payment.reference}
                onChange={(event) => onChange({ reference: event.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Sender number / account">
                <Input
                  className="bg-canvas"
                  value={payment.sender}
                  onChange={(event) => onChange({ sender: event.target.value })}
                />
              </Field>
              <Field label="Payment date">
                <Input
                  className="bg-canvas"
                  value={payment.payDate}
                  onChange={(event) => onChange({ payDate: event.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>
      ) : null}

      {isCash ? (
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
          <Checkbox
            checked={payment.cashConfirmed}
            onCheckedChange={(checked) => onChange({ cashConfirmed: checked === true })}
          />
          <span className="text-[13px] font-bold leading-snug">
            I confirm cash has been received at the front desk
          </span>
        </label>
      ) : null}

      <div className="flex items-center gap-2.5">
        <span className="text-xs font-bold text-mut">Payment status</span>
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
      </div>
    </div>
  );
}

export function admissionPaymentStatus(payment: AdmissionPayment) {
  if (payment.method === "Cash")
    return payment.cashConfirmed ? "Verified" : "Awaiting Payment";
  return payment.proofAttached ? "Under Review" : "Awaiting Payment";
}
