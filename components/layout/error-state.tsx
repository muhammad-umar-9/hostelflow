"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-bad/25 bg-badt px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-bad" />
      <p className="mt-3 text-sm font-bold text-bad">{message}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
