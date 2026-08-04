"use client";

import { Suspense } from "react";
import Link from "next/link";
import { AdmissionWizard } from "@/components/forms/admission/admission-wizard";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export default function NewAdmissionPage() {
  return (
    <AppShell bare>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="New admission"
          subtitle="Register a resident and allocate a bed"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Cancel</Link>
            </Button>
          }
        />
        <Suspense fallback={<LoadingScreen />}>
          <AdmissionWizard />
        </Suspense>
      </div>
    </AppShell>
  );
}
