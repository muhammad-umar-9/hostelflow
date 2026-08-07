"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/**
 * Sign out.
 *
 * Better Auth deletes the session **row**, not just the cookie, so the session stops
 * working everywhere at once rather than only in the browser that clicked. That is the
 * reason database sessions were chosen over JWTs: a front-desk machine left signed in at a
 * shared hostel office can be cut off from anywhere.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleSignOut = async () => {
    setPending(true);
    try {
      await signOut();
    } finally {
      // Navigate even if the request failed. Leaving someone on an authenticated screen
      // after they pressed "log out" is the worse outcome; if the row survived, the next
      // request re-authenticates and they simply land back where they were.
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className={cn(
        "flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-[12.5px] font-bold text-mut transition hover:text-ink disabled:opacity-60",
        className,
      )}
    >
      <LogOut className="h-4 w-4" />
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}
