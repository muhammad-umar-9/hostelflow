"use client";

import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";

export default function NotificationsPage() {
  const { data, loading, role } = useHostel();
  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const list =
    role === "resident" ? data.notifications.resident : data.notifications.staff;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader title="Notifications" />
        <div className="flex flex-col gap-2.5">
          {list.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-2xl border border-line bg-white p-3.5"
            >
              <span
                className={
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full " +
                  (item.tone === "bad"
                    ? "bg-bad"
                    : item.tone === "warn"
                      ? "bg-warn"
                      : "bg-ok")
                }
              />
              <div>
                <p className="text-[12.5px] font-bold leading-snug">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-mut">{item.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
