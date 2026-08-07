"use client";

import * as React from "react";
import { useHostel } from "@/components/providers/hostel-provider";
import { ScreenshotPlaceholder } from "@/components/payments/screenshot-placeholder";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";

export function PaySheet({
  residentId,
  open,
  onOpenChange,
}: {
  residentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, submitProof, mutating } = useHostel();
  const { toast } = useToast();
  const [attached, setAttached] = React.useState(false);
  if (!data) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="text-base font-extrabold">Submit payment proof</SheetTitle>
        <SheetDescription className="mt-1 text-xs leading-relaxed text-mut">
          JazzCash {data.settings.jazzcash} · Easypaisa {data.settings.easypaisa}
        </SheetDescription>
        <button
          type="button"
          className="mt-3 w-full"
          onClick={() => setAttached(!attached)}
        >
          <ScreenshotPlaceholder
            className="h-[150px]"
            label={attached ? "screenshot attached" : "tap to attach screenshot"}
          />
        </button>
        <div className="mt-3 flex gap-2.5">
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={mutating}
            onClick={async () => {
              if (!attached) {
                toast("Attach the payment screenshot first");
                return;
              }
              await submitProof(residentId);
              setAttached(false);
              onOpenChange(false);
            }}
          >
            Submit for review
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
