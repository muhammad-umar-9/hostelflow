"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-extrabold text-bad">Something went wrong</h1>
      <p className="text-xs leading-relaxed text-mut">
        {error.message || "An unexpected error stopped this screen from loading."}
      </p>
      <Button className="mt-2" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
