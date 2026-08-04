"use client";

import * as React from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { DocumentUploadList, type DocumentItem } from "@/components/forms/document-upload-list";
import type { AdmissionDocuments } from "./types";

const ITEMS: DocumentItem[] = [
  { key: "photo", label: "Resident photograph", requirement: "Required" },
  { key: "cnicFront", label: "CNIC / B-Form front", requirement: "Required" },
  { key: "cnicBack", label: "CNIC / B-Form back", requirement: "Required" },
  { key: "guardianCnic", label: "Guardian CNIC", requirement: "Optional" },
  { key: "admissionProof", label: "Student / employment card", requirement: "Optional" },
];

export function StepDocuments({
  documents,
  onChange,
  phone,
  name,
  hostelName,
  linkSent,
  onLinkSent,
}: {
  documents: AdmissionDocuments;
  onChange: (key: string, value: boolean) => void;
  phone: string;
  name: string;
  hostelName: string;
  linkSent: boolean;
  onLinkSent: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const uploadUrl = "hostelflow.pk/u/8F42QX";

  return (
    <div className="flex flex-col gap-3">
      {linkSent ? (
        <div className="rounded-2xl border border-line bg-white p-3.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warn" />
            <p className="text-[12.5px] font-extrabold">Upload link sent to {phone}</p>
          </div>
          <p className="mt-1.5 font-mono text-[11.5px] text-mut">{uploadUrl}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-mut">
            The student opens this on their own phone, photographs the documents and they
            appear here. Valid for 24 hours.
          </p>
          <div className="mt-3 flex gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => toast("Link sent again to " + phone)}
            >
              Send again
            </Button>
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href="/admissions/upload">Preview student view</Link>
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="soft" size="lg" onClick={() => setOpen(true)}>
          Send upload link to the student on WhatsApp
        </Button>
      )}

      <DocumentUploadList
        items={ITEMS}
        values={documents}
        onChange={onChange}
        waitingLabel={linkSent ? "Waiting for student upload" : undefined}
      />
      <p className="text-[11.5px] leading-relaxed text-mut">
        Uploads are simulated in this prototype. In the live app the camera opens directly
        and the image preview appears here.
      </p>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle className="text-base font-extrabold">Send upload link</SheetTitle>
          <SheetDescription className="mt-1 text-xs text-mut">
            A one-time link goes to {phone} on WhatsApp. No app or login needed.
          </SheetDescription>
          <div className="mt-3 rounded-2xl bg-[#e7f3e9] p-3.5 text-[12.5px] leading-relaxed">
            Assalam o Alaikum {name},
            <br />
            <br />
            Please upload your photograph and CNIC / B-Form pictures for your admission at{" "}
            {hostelName} using this link:
            <br />
            <br />
            <span className="font-mono text-[11.5px]">{uploadUrl}</span>
            <br />
            <br />
            The link works for 24 hours. Shukriya.
          </div>
          <div className="mt-4 flex gap-2.5">
            <Button variant="outline" size="lg" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="lg"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                onLinkSent();
                toast("Link sent to " + phone + " — valid for 24 hours");
              }}
            >
              Send on WhatsApp
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
