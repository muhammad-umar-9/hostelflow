"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/forms/form-error";
import { StepProgress } from "@/components/forms/step-progress";
import { CNIC_REGEX } from "@/lib/validations";
import type { GuardianValues, PersonalInfoValues } from "@/lib/validations";
import { StepPersonal } from "./step-personal";
import { StepGuardian } from "./step-guardian";
import { StepDocuments } from "./step-documents";
import { StepBed } from "./step-bed";
import { StepCharges } from "./step-charges";
import { StepPayment } from "./step-payment";
import { StepReview } from "./step-review";
import { ADMISSION_FORM_ID, type AdmissionPayment, type AdmissionState } from "./types";

const STEP_TITLES = [
  "Personal information",
  "Guardian and emergency",
  "Documents",
  "Room and bed",
  "Charges",
  "Payment",
  "Review and confirm",
];

const DEFAULT_PERSONAL: PersonalInfoValues = {
  name: "Zohaib Anwar",
  cnic: "35202-7788990-3",
  dob: "12 Mar 2004",
  phone: "0301 4455667",
  address: "House 24, Street 7, Johar Town, Lahore",
  city: "Lahore",
  institution: "University of Central Punjab",
  occupation: "Student",
  joining: "04 Aug 2026",
};

const DEFAULT_GUARDIAN: GuardianValues = {
  guardianName: "Anwar Mehmood",
  relationship: "Father",
  guardianCnic: "35202-1122334-5",
  guardianPhone: "0300 9988776",
  emergencyName: "Nadia Anwar",
  emergencyPhone: "0321 5566778",
};

export function AdmissionWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, admitResident, mutating } = useHostel();
  const [step, setStep] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);

  const [state, setState] = React.useState<AdmissionState>(() => ({
    personal: {
      ...DEFAULT_PERSONAL,
      name: params.get("name") || DEFAULT_PERSONAL.name,
      phone: params.get("phone") || DEFAULT_PERSONAL.phone,
      joining: params.get("joining") || DEFAULT_PERSONAL.joining,
    },
    guardian: DEFAULT_GUARDIAN,
    documents: {
      photo: false,
      cnicFront: false,
      cnicBack: false,
      guardianCnic: false,
      admissionProof: false,
    },
    linkSent: false,
    roomNo: params.get("room"),
    bedId: params.get("bed"),
    payment: {
      method: null,
      amount: 0,
      reference: "JC-4471-9020",
      sender: params.get("phone") || DEFAULT_PERSONAL.phone,
      payDate: "04 Aug 2026",
      proofAttached: false,
      cashConfirmed: false,
    },
    consent: false,
  }));

  if (!data) return null;

  const room = state.roomNo ? data.rooms.find((item) => item.no === state.roomNo) : undefined;
  const total = room
    ? room.rent + data.settings.security + data.settings.policeCharge
    : 0;

  const patchPayment = (patch: Partial<AdmissionPayment>) =>
    setState((current) => ({
      ...current,
      payment: {
        ...current.payment,
        ...patch,
        amount:
          patch.amount !== undefined
            ? patch.amount
            : current.payment.amount || total,
      },
    }));

  const goNext = () => {
    setError(null);
    if (step === 3) {
      const documents = state.documents;
      if (!documents.photo || !documents.cnicFront || !documents.cnicBack) {
        setError("Photograph and both CNIC/B-Form sides are required.");
        return;
      }
    }
    if (step === 4) {
      if (!state.roomNo || !state.bedId) {
        setError("Select a room and a specific vacant bed.");
        return;
      }
      const bed = data.rooms
        .find((item) => item.no === state.roomNo)
        ?.beds.find((item) => item.id === state.bedId);
      if (!bed || bed.state === "occupied") {
        setError("That bed was just taken. Pick another vacant bed.");
        return;
      }
    }
    if (step === 5) {
      patchPayment({ amount: state.payment.amount || total });
    }
    if (step === 6) {
      const payment = state.payment;
      if (!payment.method) {
        setError("Choose how the payment was made.");
        return;
      }
      if (payment.method === "Cash" && !payment.cashConfirmed) {
        setError("Confirm that cash has been received.");
        return;
      }
      if (payment.method !== "Cash" && (!payment.proofAttached || !payment.reference)) {
        setError("Attach the payment screenshot and enter a reference ID.");
        return;
      }
      if (!payment.amount || payment.amount <= 0) {
        setError("Enter the amount received.");
        return;
      }
    }
    setStep((current) => Math.min(7, current + 1));
  };

  const goBack = () => {
    setError(null);
    if (step === 1) {
      router.back();
      return;
    }
    setStep((current) => current - 1);
  };

  const confirm = async () => {
    setError(null);
    if (!state.consent) {
      setError("Tick the consent checkbox to confirm the admission.");
      return;
    }
    if (!room || !state.bedId || !state.payment.method) return;
    if (!CNIC_REGEX.test(state.personal.cnic)) {
      setError("CNIC must look like 35202-1234567-1.");
      return;
    }
    const result = await admitResident({
      ...state.personal,
      ...state.guardian,
      documents: state.documents,
      roomNo: room.no,
      bedId: state.bedId,
      method: state.payment.method,
      amountPaid: state.payment.amount,
      reference: state.payment.reference,
    });
    if (!result.residentId) {
      setError(result.message);
      return;
    }
    const query = new URLSearchParams({
      resident: result.residentId,
      receipt: result.receiptId || "",
      amount: String(state.payment.amount),
      balance: String(Math.max(0, total - state.payment.amount)),
      status: state.payment.method === "Cash" ? "Verified" : "Under Review",
    });
    router.push("/admissions/success?" + query.toString());
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11.5px] font-semibold text-mut">
          Step {step} of 7 · {STEP_TITLES[step - 1]}
        </p>
        <StepProgress step={step} total={7} />
      </div>

      <FormError message={error} />

      {step === 1 ? (
        <StepPersonal
          value={state.personal}
          onNext={(values) => {
            const duplicate = data.residents.some(
              (resident) => resident.status === "active" && resident.cnic === values.cnic,
            );
            if (duplicate) {
              setError("An active resident already exists with this CNIC.");
              return;
            }
            setState((current) => ({ ...current, personal: values }));
            setError(null);
            setStep(2);
          }}
        />
      ) : null}

      {step === 2 ? (
        <StepGuardian
          value={state.guardian}
          onNext={(values) => {
            setState((current) => ({ ...current, guardian: values }));
            setStep(3);
          }}
        />
      ) : null}

      {step === 3 ? (
        <StepDocuments
          documents={state.documents}
          hostelName={data.settings.name}
          name={state.personal.name}
          phone={state.personal.phone}
          linkSent={state.linkSent}
          onLinkSent={() => setState((current) => ({ ...current, linkSent: true }))}
          onChange={(key, value) =>
            setState((current) => ({
              ...current,
              documents: { ...current.documents, [key]: value },
            }))
          }
        />
      ) : null}

      {step === 4 ? (
        <StepBed
          data={data}
          roomNo={state.roomNo}
          bedId={state.bedId}
          onSelect={(roomNo, bedId) =>
            setState((current) => ({ ...current, roomNo, bedId }))
          }
        />
      ) : null}

      {step === 5 && room && state.bedId ? (
        <StepCharges room={room} bedId={state.bedId} settings={data.settings} />
      ) : null}

      {step === 6 ? (
        <StepPayment
          payment={{ ...state.payment, amount: state.payment.amount || total }}
          onChange={patchPayment}
        />
      ) : null}

      {step === 7 && room ? (
        <StepReview
          state={{ ...state, payment: { ...state.payment, amount: state.payment.amount || total } }}
          room={room}
          settings={data.settings}
          onEdit={(target) => setStep(target)}
          onConsentChange={(value) => setState((current) => ({ ...current, consent: value }))}
        />
      ) : null}

      <div className="print-hide fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/97 px-4 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-[560px] gap-2.5">
          <Button variant="outline" size="lg" onClick={goBack} disabled={mutating}>
            Back
          </Button>
          {step === 1 || step === 2 ? (
            <Button type="submit" form={ADMISSION_FORM_ID} size="lg" className="flex-1">
              Continue
            </Button>
          ) : (
            <Button
              size="lg"
              className="flex-1"
              disabled={mutating}
              onClick={step === 7 ? confirm : goNext}
            >
              {mutating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === 7 ? "Confirm Admission" : "Continue"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
