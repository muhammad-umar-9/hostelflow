"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DemoResetButton() {
  const { resetDemo } = useHostel();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset demo data
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset the demo?</DialogTitle>
          <DialogDescription>
            Every admission, payment approval and checkout made in this session is
            discarded and H-K Boys Hostel returns to its starting state.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1">
              Cancel
            </Button>
          </DialogClose>
          <Button
            className="flex-1"
            onClick={async () => {
              setOpen(false);
              await resetDemo();
            }}
          >
            Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
