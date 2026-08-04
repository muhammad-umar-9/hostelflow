"use client";

import { AppShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { PageHeader } from "@/components/layout/page-header";
import { useHostel } from "@/components/providers/hostel-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ResidentRequestsPage() {
  const { data, loading, addMaintenanceRequest, mutating } = useHostel();
  if (loading || !data) {
    return (
      <AppShell>
        <LoadingScreen />
      </AppShell>
    );
  }

  const requests = data.requests.filter(
    (request) => request.residentId === data.currentResidentId,
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <PageHeader showBack={false} title="Requests" />
        <Button
          size="lg"
          disabled={mutating}
          onClick={() =>
            addMaintenanceRequest(data.currentResidentId, "Water leakage under the sink")
          }
        >
          New maintenance request
        </Button>
        {requests.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="Report a leak, a broken fan or anything else and the manager sees it here."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-3.5"
              >
                <div className="flex-1">
                  <p className="text-[12.5px] font-bold">{request.title}</p>
                  <p className="mt-0.5 text-[11px] text-mut">{request.date}</p>
                </div>
                <Badge tone={request.status === "Resolved" ? "success" : "warning"}>
                  {request.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
