import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-mono text-xs text-mut">404</p>
      <h1 className="text-xl font-extrabold">This screen does not exist</h1>
      <p className="text-xs leading-relaxed text-mut">
        The page you followed is not part of HostelFlow. Head back to the dashboard.
      </p>
      <Button asChild className="mt-2">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </main>
  );
}
