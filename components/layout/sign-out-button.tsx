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
 *
 * A failure must never be reported as success. An earlier version navigated from a
 * `finally` block, so a rejected request — offline, or the container restarting — still
 * sent the user to /login; the cookie was still valid, so the login page bounced them
 * straight back to the dashboard, and they walked away from a shared machine believing
 * they had signed out. On the one screen where that belief matters, silence is the bug.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const handleSignOut = async () => {
    setPending(true);
    setFailed(false);

    try {
      // better-fetch resolves with `{ error }` for an HTTP failure and rejects outright
      // when the request never completes, so both have to be handled.
      const result = await signOut();
      if (result?.error)
        throw new Error(String(result.error.status ?? "sign-out failed"));
    } catch {
      setFailed(true);
      setPending(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-[12.5px] font-bold text-mut transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:pointer-events-none disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        {pending ? "Signing out…" : "Log out"}
      </button>
      {failed ? (
        <p
          role="alert"
          className="text-[11px] font-semibold text-[var(--danger,#b42318)]"
        >
          Could not sign out — you are still signed in. Try again.
        </p>
      ) : null}
    </div>
  );
}
