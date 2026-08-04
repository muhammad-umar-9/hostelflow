"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatPKR, maskCnic } from "@/lib/formatters";
import type { HostelSettings, Receipt, Resident } from "@/lib/types";

export function ReceiptView({
  receipt,
  resident,
  settings,
}: {
  receipt: Receipt;
  resident: Resident;
  settings: HostelSettings;
}) {
  const { toast } = useToast();
  const totalLabel = receipt.kind === "settlement" ? "Amount refunded" : "Total received";

  return (
    <div className="flex flex-col gap-3">
      <article className="overflow-hidden rounded-3xl border border-line bg-white">
        <header className="bg-p p-4 text-white">
          <p className="text-[17px] font-extrabold">{settings.name}</p>
          <p className="mt-0.5 text-[11.5px] text-white/70">{settings.address}</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-white/60">RECEIPT NO</p>
              <p className="mt-0.5 font-mono text-[13px]">{receipt.id}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-white/60">DATE</p>
              <p className="mt-0.5 text-xs font-bold">{receipt.date}</p>
            </div>
          </div>
        </header>
        <dl className="flex flex-col gap-2.5 p-4 text-[12.5px]">
          <Row label="Resident" value={resident.name} />
          <Row label="CNIC" value={maskCnic(resident.cnic)} mono />
          <Row label="Room" value={"Room " + resident.room + " · Bed " + resident.bed} />
          <Row label="Purpose" value={receipt.purpose} />
          <Row label="Rent month" value={receipt.month} />
          <Row label="Method" value={String(receipt.method)} />
          <Row label="Reference" value={receipt.reference} mono />
          <div className="my-0.5 h-px bg-line" />
          {receipt.rent > 0 ? <Row label="Rent" value={formatPKR(receipt.rent)} /> : null}
          {receipt.security > 0 ? (
            <Row label="Security deposit (refundable)" value={formatPKR(receipt.security)} />
          ) : null}
          {receipt.policeCharge > 0 ? (
            <Row label="Police form charge" value={formatPKR(receipt.policeCharge)} />
          ) : null}
          <div className="my-0.5 h-px bg-line" />
          <div className="flex items-baseline justify-between">
            <dt className="text-[13.5px] font-extrabold">{totalLabel}</dt>
            <dd className="text-lg font-extrabold text-ok">{formatPKR(receipt.total)}</dd>
          </div>
          <Row label="Remaining balance" value={formatPKR(receipt.balance)} />
          <Row label="Verified by" value={receipt.verifiedBy} />
          <p className="mt-1.5 border-t border-dashed border-line pt-3 text-[11px] leading-relaxed text-mut">
            {settings.receiptFooter}
          </p>
        </dl>
      </article>

      <div className="print-hide grid grid-cols-2 gap-2.5">
        <Button onClick={() => window.print()}>Download PDF</Button>
        <Button
          variant="outline"
          onClick={() => toast("Receipt shared with " + resident.name + " on WhatsApp")}
        >
          Share on WhatsApp
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="outline" asChild>
          <Link href={"/residents/detail?id=" + resident.id}>Payment history</Link>
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="font-semibold text-mut">{label}</dt>
      <dd className={mono ? "text-right font-mono text-[12px]" : "text-right font-bold"}>{value}</dd>
    </div>
  );
}
