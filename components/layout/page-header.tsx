"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import { useHostel } from "@/components/providers/hostel-provider";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  urdu?: string;
  backHref?: string;
  showBack?: boolean;
  showBell?: boolean;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  urdu,
  backHref,
  showBack = true,
  showBell = false,
  action,
}: PageHeaderProps) {
  const router = useRouter();
  const { role, data } = useHostel();
  const count =
    data === null
      ? 0
      : role === "resident"
        ? data.notifications.resident.length
        : data.notifications.staff.length;

  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {showBack ? (
          backHref ? (
            <Link
              href={backHref}
              aria-label="Back"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              aria-label="Back"
              onClick={() => router.back()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )
        ) : null}
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-[11.5px] font-semibold text-mut">{subtitle}</p>
          ) : null}
          {urdu ? (
            <p className="mt-1 font-urdu text-[10px] leading-[2.2] text-mut">{urdu}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {action}
        {showBell ? (
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
