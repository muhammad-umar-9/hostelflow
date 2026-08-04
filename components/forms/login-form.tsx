"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { FormError } from "./form-error";
import { PHONE_REGEX } from "@/lib/validations";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "resident", label: "Resident" },
];

export function LoginForm() {
  const router = useRouter();
  const { setRole } = useHostel();
  const [phone, setPhone] = React.useState("0300 1234567");
  const [otp, setOtp] = React.useState<string[]>([]);
  const [role, setSelectedRole] = React.useState<Role>("owner");
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [signingIn, setSigningIn] = React.useState(false);

  const sendOtp = () => {
    if (!PHONE_REGEX.test(phone.trim())) {
      setError("Enter a valid number like 0300 1234567");
      return;
    }
    setError(null);
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setOtp(["4", "2", "9", "1"]);
    }, 800);
  };

  const submit = () => {
    if (otp.length !== 4) {
      setError("Send and enter the OTP first");
      return;
    }
    setError(null);
    setSigningIn(true);
    setTimeout(() => {
      setRole(role);
      router.push(role === "resident" ? "/resident-portal" : "/dashboard");
    }, 700);
  };

  return (
    <div className="flex min-h-screen flex-col bg-p px-6 pb-8 pt-16">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col">
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

        <p className="mt-8 text-xs font-bold tracking-wide text-white/60">
          MOBILE NUMBER
        </p>
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="rounded-xl bg-white/10 px-3 py-3.5 text-[15px] font-semibold text-white">
            +92
          </span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-label="Mobile number"
            placeholder="0300 1234567"
            className="min-h-[52px] w-full min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3.5 text-[15px] font-semibold text-white outline-none placeholder:text-white/40 focus:border-white"
          />
        </div>
        <Button
          variant="outline"
          className="mt-3 border-white/30 bg-transparent text-white hover:bg-white/10"
          onClick={sendOtp}
          disabled={sending}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Send OTP
        </Button>

        {otp.length === 4 ? (
          <div className="mt-5 animate-fade-up">
            <p className="text-xs font-bold tracking-wide text-white/60">ENTER OTP</p>
            <div className="mt-2.5 flex gap-2.5">
              {otp.map((digit, index) => (
                <span
                  key={index}
                  className="flex h-14 flex-1 items-center justify-center rounded-xl bg-white font-mono text-xl font-bold text-p"
                >
                  {digit}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-white/55">
              Demo code filled automatically. Resend in 0:24
            </p>
          </div>
        ) : null}

        <p className="mt-6 text-xs font-bold tracking-wide text-white/60">DEMO ROLE</p>
        <div className="mt-2.5 flex gap-2">
          {ROLES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setSelectedRole(item.value)}
              className={cn(
                "min-h-[46px] flex-1 rounded-xl border text-[12.5px] font-bold transition",
                role === item.value
                  ? "border-white bg-white text-p"
                  : "border-white/25 bg-white/10 text-white/80",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-4">
            <FormError message={error} />
          </div>
        ) : null}

        <div className="flex-1" />
        <Button
          size="lg"
          className="mt-6 bg-white text-p hover:bg-white/90"
          onClick={submit}
          disabled={signingIn}
        >
          {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue
        </Button>
        <p className="mt-3.5 text-center text-[11px] text-white/45">
          H-K Boys Hostel · Lahore · Demo build
        </p>
      </div>
    </div>
  );
}
