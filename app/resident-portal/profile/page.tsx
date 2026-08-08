"use client";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { ResidentAvatar } from "@/components/residents/resident-avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatPKR, maskCnic } from "@/lib/formatters";
import { getResident } from "@/lib/mock-data/selectors";

export default function ResidentProfilePage() {
  const { data, loading } = useHostel();
  const { toast } = useToast();

  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const resident = getResident(data, data.currentResidentId);
  if (!resident) return null;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader showBack={false} title="My profile" />
        <div className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4">
          <ResidentAvatar
            initials={resident.initials}
            color={resident.color}
            className="h-14 w-14 rounded-[18px] text-lg"
          />
          <div>
            <p className="text-[17px] font-extrabold">{resident.name}</p>
            <p className="mt-0.5 text-[11.5px] text-mut">
              Room {resident.room} · Bed {resident.bed} · {resident.roomType}
            </p>
          </div>
        </div>
        <dl className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-4 text-[12.5px]">
          <Row label="CNIC" value={maskCnic(resident.cnic)} mono />
          <Row label="WhatsApp" value={resident.phone} />
          <Row label="Institution" value={resident.institution} />
          <Row label="Joined" value={resident.joined} />
          <Row label="Monthly rent" value={formatPKR(resident.rent)} />
          <Row
            label="Guardian"
            value={resident.guardian.name + " · " + resident.guardian.phone}
          />
        </dl>
        <div className="flex flex-col gap-2.5">
          <Button variant="outline" onClick={() => toast("Emergency contact updated")}>
            Update emergency contact
          </Button>
          <Button
            variant="ghost"
            className="border border-line bg-canvas"
            onClick={() => toast("Only the hostel manager can change this")}
          >
            Room, rent and deposit — managed by the hostel
          </Button>

          {/*
            The resident's only way out on a phone.

            RESIDENT_NAV has no "More" entry, the sidebar carrying the staff sign-out is
            `hidden … lg:flex`, and /login now redirects a signed-in visitor away — so
            until this was added, a resident who signed in on a shared or borrowed handset
            stayed signed in permanently, on the device class this application is built
            for first.
          */}
          <SignOutButton className="mt-2" />
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="font-semibold text-mut">{label}</dt>
      <dd className={mono ? "text-right font-mono text-[12px]" : "text-right font-bold"}>
        {value}
      </dd>
    </div>
  );
}
