"use client";

import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { POLICE_STAGE_LABELS } from "@/lib/constants";
import type { PoliceStage } from "@/lib/types";

const STAGES: PoliceStage[] = [
  "prepared",
  "submitted",
  "verified",
  "rejected",
  "incomplete",
];

export function PoliceStatusSheet({
  residentId,
  open,
  onOpenChange,
}: {
  residentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { setPoliceStage, mutating } = useHostel();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="text-base font-extrabold">Update police verification</SheetTitle>
        <SheetDescription className="mt-1 text-xs leading-relaxed text-mut">
          The Rs 300 charge is a hostel charge and does not mean verification is complete.
        </SheetDescription>
        <div className="mt-4 flex flex-col gap-2">
          {STAGES.map((stage) => (
            <Button
              key={stage}
              variant="outline"
              size="lg"
              disabled={mutating}
              className="justify-start"
              onClick={async () => {
                await setPoliceStage(residentId, stage);
                onOpenChange(false);
              }}
            >
              {POLICE_STAGE_LABELS[stage]}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
