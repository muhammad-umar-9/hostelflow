"use client";

import * as React from "react";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatPKR } from "@/lib/formatters";
import { getInvoice, getResident } from "@/lib/mock-data/selectors";

interface ReminderDialogProps {
  residentIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

export function ReminderDialog({
  residentIds,
  open,
  onOpenChange,
  onSent,
}: ReminderDialogProps) {
  const { data, sendReminders, mutating } = useHostel();
  const [sending, setSending] = React.useState(false);
  if (!data) return null;

  const first = residentIds.length ? getResident(data, residentIds[0]) : undefined;
  const invoice = first ? getInvoice(data, first.id) : undefined;
  const balance = invoice ? invoice.due - invoice.received : 0;

  const message = first
    ? [
        "Assalam o Alaikum " + first.name + ",",
        "",
        "Your rent for August 2026 at " +
          data.settings.name +
          " (Room " +
          first.room +
          ", Bed " +
          first.bed +
          ") is " +
          formatPKR(balance) +
          ", due on " +
          (invoice ? invoice.dueDate : "") +
          ".",
        "",
        "JazzCash: " + data.settings.jazzcash,
        "Easypaisa: " + data.settings.easypaisa,
        "Bank: " + data.settings.bank,
        "",
        "Please send the payment screenshot in the app after paying. Shukriya.",
      ].join("\n")
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="text-base font-extrabold">
          WhatsApp reminder preview
        </SheetTitle>
        <SheetDescription className="mt-1 text-xs text-mut">
          {residentIds.length} residents selected · each message is personalised
        </SheetDescription>
        <pre className="mt-3 max-h-[250px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[#e7f3e9] p-3.5 font-sans text-[12.5px] leading-relaxed text-ink">
          {message}
        </pre>
        <div className="mt-4 flex gap-2.5">
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            size="lg"
            className="flex-1"
            disabled={sending || mutating || residentIds.length === 0}
            onClick={async () => {
              setSending(true);
              await sendReminders(residentIds);
              setSending(false);
              onOpenChange(false);
              onSent();
            }}
          >
            {sending ? "Sending ..." : "Send on WhatsApp"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
