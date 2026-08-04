"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Bed } from "@/lib/types";

interface BedActionSheetProps {
  roomNo: string;
  bed: Bed | null;
  onOpenChange: (open: boolean) => void;
}

export function BedActionSheet({ roomNo, bed, onOpenChange }: BedActionSheetProps) {
  const router = useRouter();
  const { setBedState, mutating } = useHostel();
  if (!bed) return null;

  const isHeld = bed.state === "held";
  const isMaintenance = bed.state === "maintenance";

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="text-base font-extrabold">
          Room {roomNo} · Bed {bed.id}
        </SheetTitle>
        <SheetDescription className="mt-1 text-xs text-mut">
          Choose what to do with this bed
        </SheetDescription>
        <div className="mt-4 flex flex-col gap-2.5">
          <Button
            size="lg"
            onClick={() =>
              router.push("/admissions/new?room=" + roomNo + "&bed=" + bed.id)
            }
          >
            Allocate this bed
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={mutating}
            onClick={async () => {
              await setBedState(roomNo, bed.id, isHeld ? "vacant" : "held");
              onOpenChange(false);
            }}
          >
            {isHeld ? "Release hold" : "Hold for visitor"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={mutating}
            onClick={async () => {
              await setBedState(roomNo, bed.id, isMaintenance ? "vacant" : "maintenance");
              onOpenChange(false);
            }}
          >
            {isMaintenance ? "Clear maintenance" : "Mark under maintenance"}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
