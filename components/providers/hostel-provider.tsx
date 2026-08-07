"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { hostelRepository } from "@/lib/repository";
import type {
  AdmissionInput,
  CheckoutInput,
  EnquiryInput,
  MutationResult,
} from "@/lib/repository";
import type {
  BedState,
  EnquiryStatus,
  HostelData,
  HostelSettings,
  PoliceStage,
  Role,
} from "@/lib/types";
import type { Viewer } from "@/lib/server/viewer";

interface HostelContextValue {
  data: HostelData | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  /**
   * Presentation only. Resolved on the server from HostelMembership, never writable from
   * the browser. Rendering an owner-only control off this value is fine; *authorizing* one
   * off it is not — the server action behind it must call requireOwner() for itself.
   */
  role: Role;
  viewer: Viewer;
  reload: () => Promise<void>;
  resetDemo: () => Promise<void>;
  admitResident: (input: AdmissionInput) => Promise<MutationResult>;
  recordCashPayment: (residentId: string, amount: number) => Promise<MutationResult>;
  approveProof: (proofId: string, amount: number) => Promise<MutationResult>;
  rejectProof: (proofId: string, reason: string) => Promise<MutationResult>;
  submitProof: (residentId: string) => Promise<MutationResult>;
  sendReminders: (residentIds: string[]) => Promise<MutationResult>;
  setBedState: (
    roomNo: string,
    bedId: string,
    state: BedState,
  ) => Promise<MutationResult>;
  setPoliceStage: (residentId: string, stage: PoliceStage) => Promise<MutationResult>;
  setEnquiryStatus: (enquiryId: string, status: EnquiryStatus) => Promise<MutationResult>;
  addEnquiry: (input: EnquiryInput) => Promise<MutationResult>;
  completeCheckout: (residentId: string, input: CheckoutInput) => Promise<MutationResult>;
  addMaintenanceRequest: (residentId: string, title: string) => Promise<MutationResult>;
  updateSettings: (patch: Partial<HostelSettings>) => Promise<MutationResult>;
}

const HostelContext = React.createContext<HostelContextValue | null>(null);

export function HostelProvider({
  viewer,
  children,
}: {
  viewer: Viewer;
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const [data, setData] = React.useState<HostelData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [mutating, setMutating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const role = viewer.role;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await hostelRepository.getSnapshot();
      setData(snapshot);
    } catch {
      setError("Could not load hostel data. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // TODO(backend milestone): replace this client-side snapshot fetch with server
  // components that read only the records the signed-in user is allowed to see.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() flips the loading flag before awaiting
    void load();
  }, [load]);

  const run = React.useCallback(
    async (
      action: (current: HostelData) => Promise<MutationResult>,
      options?: { silent?: boolean },
    ): Promise<MutationResult> => {
      if (!data) return { data: {} as HostelData, message: "Data not ready" };
      setMutating(true);
      try {
        const result = await action(data);
        if (result.data && result.data.rooms) setData(result.data);
        if (!options?.silent && result.message) toast(result.message);
        return result;
      } catch {
        toast("Something went wrong. Nothing was saved.");
        return { data, message: "error" };
      } finally {
        setMutating(false);
      }
    },
    [data, toast],
  );

  const value = React.useMemo<HostelContextValue>(
    () => ({
      data,
      loading,
      mutating,
      error,
      role,
      viewer,
      reload: load,
      resetDemo: async () => {
        setLoading(true);
        const fresh = await hostelRepository.reset();
        setData(fresh);
        setLoading(false);
        toast("Demo data reset");
      },
      admitResident: (input) =>
        run((current) => hostelRepository.admitResident(current, input)),
      recordCashPayment: (residentId, amount) =>
        run((current) => hostelRepository.recordCashPayment(current, residentId, amount)),
      approveProof: (proofId, amount) =>
        run((current) => hostelRepository.approveProof(current, proofId, amount)),
      rejectProof: (proofId, reason) =>
        run((current) => hostelRepository.rejectProof(current, proofId, reason)),
      submitProof: (residentId) =>
        run((current) => hostelRepository.submitProof(current, residentId)),
      sendReminders: (residentIds) =>
        run((current) => hostelRepository.sendReminders(current, residentIds)),
      setBedState: (roomNo, bedId, state) =>
        run((current) => hostelRepository.setBedState(current, roomNo, bedId, state)),
      setPoliceStage: (residentId, stage) =>
        run((current) => hostelRepository.setPoliceStage(current, residentId, stage)),
      setEnquiryStatus: (enquiryId, status) =>
        run((current) => hostelRepository.setEnquiryStatus(current, enquiryId, status)),
      addEnquiry: (input) =>
        run((current) => hostelRepository.addEnquiry(current, input)),
      completeCheckout: (residentId, input) =>
        run((current) => hostelRepository.completeCheckout(current, residentId, input)),
      addMaintenanceRequest: (residentId, title) =>
        run((current) =>
          hostelRepository.addMaintenanceRequest(current, residentId, title),
        ),
      updateSettings: (patch) =>
        run((current) => hostelRepository.updateSettings(current, patch)),
    }),
    [data, loading, mutating, error, role, viewer, load, run, toast],
  );

  return <HostelContext.Provider value={value}>{children}</HostelContext.Provider>;
}

export function useHostel() {
  const context = React.useContext(HostelContext);
  if (!context) throw new Error("useHostel must be used inside HostelProvider");
  return context;
}
