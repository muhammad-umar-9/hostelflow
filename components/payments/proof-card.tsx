import Link from "next/link";
import { ResidentAvatar } from "@/components/residents/resident-avatar";
import { formatPKR } from "@/lib/formatters";
import type { PaymentProof, Resident } from "@/lib/types";

export function ProofCard({
  proof,
  resident,
}: {
  proof: PaymentProof;
  resident: Resident;
}) {
  return (
    <Link
      href={"/payments/proofs/detail?id=" + proof.id}
      className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 transition hover:border-p/40"
    >
      <ResidentAvatar initials={resident.initials} color={resident.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold">{resident.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-mut">
          Room {resident.room} · Bed {resident.bed} · {proof.method}
        </p>
        <p className="mt-0.5 text-[11px] text-mut">{proof.submittedAt}</p>
      </div>
      <span className="text-sm font-extrabold">{formatPKR(proof.amount)}</span>
    </Link>
  );
}
