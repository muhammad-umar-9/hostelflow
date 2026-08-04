import { Badge } from "@/components/ui/badge";
import {
  BED_STATE_LABELS,
  INVOICE_STATUS_LABELS,
  POLICE_STAGE_LABELS,
} from "@/lib/constants";
import type { BedState, InvoiceStatus, PoliceStage } from "@/lib/types";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const INVOICE_TONES: Record<InvoiceStatus, Tone> = {
  paid: "success",
  unpaid: "danger",
  overdue: "danger",
  partial: "warning",
  proof: "warning",
  waived: "neutral",
};

const POLICE_TONES: Record<PoliceStage, Tone> = {
  verified: "success",
  not_started: "danger",
  incomplete: "danger",
  rejected: "danger",
  prepared: "warning",
  submitted: "warning",
};

const BED_TONES: Record<BedState, Tone> = {
  vacant: "success",
  occupied: "primary",
  held: "warning",
  maintenance: "neutral",
  checkout: "danger",
};

export function InvoiceStatusBadge({
  status,
  prefix,
}: {
  status: InvoiceStatus;
  prefix?: string;
}) {
  return (
    <Badge tone={INVOICE_TONES[status]}>
      {(prefix ? prefix + " " : "") + INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PoliceStatusBadge({
  stage,
  prefix,
}: {
  stage: PoliceStage;
  prefix?: string;
}) {
  return (
    <Badge tone={POLICE_TONES[stage]}>
      {(prefix ? prefix + " " : "") + POLICE_STAGE_LABELS[stage]}
    </Badge>
  );
}

export function BedStateBadge({ state }: { state: BedState }) {
  return <Badge tone={BED_TONES[state]}>{BED_STATE_LABELS[state]}</Badge>;
}
