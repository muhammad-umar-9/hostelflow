"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FormError } from "./form-error";

/**
 * Real sign-in.
 *
 * What this replaced: a mobile number, a fake OTP that filled itself in with `4291`, and
 * three buttons labelled DEMO ROLE that let whoever opened the page choose to be the
 * owner. Every one of those was reachable by anybody who could load the login screen.
 *
 * The visual design is unchanged on purpose — same navy field, same spacing, same
 * typography. Only the credentials are real.
 */
export function LoginForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [signingIn, setSigningIn] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError(null);
    setSigningIn(true);

    let signInError: { status?: number } | null = null;
    try {
      const result = await signIn.email({ email: email.trim(), password });
      signInError = result.error ?? null;
    } catch {
      // better-fetch rejects rather than resolving with `{ error }` when the request never
      // completes — a dropped connection, or the container restarting mid-deploy. Without
      // this the handler died here: the spinner ran forever, no message appeared, and the
      // only way out was reloading the page by hand.
      setError("Could not reach the server. Check the connection and try again.");
      setSigningIn(false);
      return;
    }

    if (signInError) {
      setError(
        signInError.status === 429
          ? // Sign-in is limited to 5 attempts in 5 minutes. Reporting this as a wrong
            // password sends the front desk hunting for a password that is in fact
            // correct; the anti-enumeration argument covers 401 versus 404, not 429.
            "Too many attempts. Wait a few minutes and try again."
          : // One message for every other cause. Distinguishing "no such account" from
            // "wrong password" tells an attacker which addresses are real, and on a
            // deployment this small the owner's address is easy to guess.
            "Those details did not match. Check them and try again.",
      );
      setSigningIn(false);
      return;
    }

    // `next` was validated on the server as a path on this site; falling back to "/" lets
    // app/page.tsx resolve the right home from the membership. `refresh` makes the layout
    // re-resolve the session so the navigation is drawn for the right role.
    router.replace(next ?? "/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col bg-p px-6 pb-8 pt-16">
      <form
        onSubmit={submit}
        className="mx-auto flex w-full max-w-[420px] flex-1 flex-col"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-extrabold text-p">
          H
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
          HostelFlow
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Private hostel management made simple
        </p>
        <p className="mt-2 font-urdu text-xs leading-[2.4] text-white/55">
          ہاسٹل کا انتظام، آسان طریقے سے
        </p>

        <label
          htmlFor="email"
          className="mt-8 text-xs font-bold tracking-wide text-white/60"
        >
          EMAIL
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="you@example.com"
          className="mt-2.5 min-h-[52px] w-full rounded-xl border border-white/20 bg-white/10 px-3.5 text-[15px] font-semibold text-white outline-none placeholder:text-white/40 focus:border-white"
        />

        <label
          htmlFor="password"
          className="mt-5 text-xs font-bold tracking-wide text-white/60"
        >
          PASSWORD
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          placeholder="••••••••••••"
          className="mt-2.5 min-h-[52px] w-full rounded-xl border border-white/20 bg-white/10 px-3.5 text-[15px] font-semibold text-white outline-none placeholder:text-white/40 focus:border-white"
        />

        {error ? (
          <div className="mt-4">
            <FormError message={error} />
          </div>
        ) : null}

        <div className="flex-1" />

        <Button
          type="submit"
          size="lg"
          className="mt-6 bg-white text-p hover:bg-white/90"
          disabled={signingIn}
        >
          {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </Button>

        {/*
          No "create an account" link, and no password reset: sign-up is disabled server
          side, and with no email transport configured a reset link would silently never
          arrive. Both are owner-driven until email is wired up.
        */}
        <p className="mt-3.5 text-center text-[11px] text-white/45">
          H-K Boys Hostel · Lahore
        </p>
      </form>
    </div>
  );
}
