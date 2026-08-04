"use client";

import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatPKR } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const OPTIONAL_CHARGES: { label: string; key: "messCharges" | "utilityBilling" }[] = [
  { label: "Mess / food charges", key: "messCharges" },
  { label: "Utility billing", key: "utilityBilling" },
];

const PERMISSIONS: [string, boolean][] = [
  ["Register residents", true],
  ["Record and verify payments", true],
  ["Update police status", true],
  ["Delete financial records", false],
  ["Change rent amounts", false],
];

export default function SettingsPage() {
  const { data, loading, updateSettings } = useHostel();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const settings = data.settings;
  const notEditable = () => toast("Editable in the live app — demo values are fixed here");

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader title="Settings" backHref="/more" />

        <Section title="HOSTEL">
          <button type="button" onClick={notEditable} className="flex w-full flex-col gap-3 text-left">
            <Row label="Name" value={settings.name} />
            <Row label="Address" value={settings.address} />
            <Row label="Floors" value={String(settings.floors)} />
            <Row label="Rooms · beds" value={settings.rooms + " · " + settings.beds} />
          </button>
        </Section>

        <Section title="CHARGES">
          <button type="button" onClick={notEditable} className="flex w-full flex-col gap-3 text-left">
            <Row label="Three-seater rent" value={formatPKR(settings.rentThreeSeater)} />
            <Row label="Four-seater rent" value={formatPKR(settings.rentFourSeater)} />
            <Row label="Security deposit" value={formatPKR(settings.security)} />
            <Row label="Police form charge" value={formatPKR(settings.policeCharge)} />
            <Row label="Rent due date" value={settings.dueDate} />
            <Row label="Notice period" value={settings.noticePeriod} />
          </button>
        </Section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-xs font-extrabold text-mut">OPTIONAL CHARGES</h2>
          {OPTIONAL_CHARGES.map(({ label, key }) => {
            const enabled = settings[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  updateSettings(
                    key === "messCharges"
                      ? { messCharges: !enabled }
                      : { utilityBilling: !enabled },
                  )
                }
                className="flex w-full items-center gap-2.5 rounded-2xl border border-line bg-white p-3.5"
              >
                <span className="flex-1 text-left text-[12.5px] font-bold">{label}</span>
                <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</Badge>
              </button>
            );
          })}
        </section>

        <Section title="PAYMENT DETAILS">
          <button type="button" onClick={notEditable} className="flex w-full flex-col gap-3 text-left text-xs">
            <Block label="Bank">{settings.bank}</Block>
            <Block label="JazzCash">{settings.jazzcash}</Block>
            <Block label="Easypaisa">{settings.easypaisa}</Block>
            <Block label="Receipt footer">{settings.receiptFooter}</Block>
            <Block label="Accepted methods">{settings.methods.join(" · ")}</Block>
          </button>
        </Section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-xs font-extrabold text-mut">APP THEME</h2>
          <div className="flex gap-2">
            {(["navy", "green", "teal"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={cn(
                  "min-h-[44px] flex-1 rounded-xl border text-xs font-bold capitalize transition",
                  theme === option
                    ? "border-p bg-p text-white"
                    : "border-line bg-white text-mut",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <Section title="MANAGER PERMISSIONS">
          <div className="flex flex-col gap-3">
            {PERMISSIONS.map(([label, allowed]) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="flex-1 text-[12.5px] font-semibold">{label}</span>
                <Badge tone={allowed ? "success" : "danger"}>
                  {allowed ? "Allowed" : "Blocked"}
                </Badge>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-xs font-extrabold text-mut">{title}</h2>
      <div className="rounded-2xl border border-line bg-white p-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex justify-between gap-3 text-[12.5px]">
      <span className="font-semibold text-mut">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </span>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="block">
      <span className="font-semibold text-mut">{label}</span>
      <span className="mt-1 block font-bold leading-relaxed">{children}</span>
    </span>
  );
}
