"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { DemoResetButton } from "@/components/layout/demo-reset-button";

const ITEMS = [
  { href: "/enquiries", title: "Walk-in enquiries", description: "Leads, visits and held beds" },
  { href: "/police-verification", title: "Police verification", description: "Track forms and submissions" },
  { href: "/payments/proofs", title: "Payment proofs", description: "Approval queue" },
  { href: "/receipts", title: "Receipts", description: "Every receipt generated" },
  { href: "/notifications", title: "Notifications", description: "Alerts and reminders" },
  { href: "/settings", title: "Settings", description: "Hostel, rooms, rent and payments" },
  { href: "/login", title: "Switch role / log out", description: "Back to the demo login" },
];

export default function MorePage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader showBack={false} title="More" />
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 transition hover:border-p/40"
            >
              <span className="flex-1">
                <span className="block text-[13.5px] font-bold">{item.title}</span>
                <span className="mt-0.5 block text-[11.5px] text-mut">{item.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-[#b6bcc6]" />
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
          <RoleSwitcher />
          <DemoResetButton />
        </div>
      </div>
    </AppShell>
  );
}
