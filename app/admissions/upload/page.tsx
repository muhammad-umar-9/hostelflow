"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const ITEMS = [
  { key: "photo", label: "Your photograph", hint: "A clear face photo", required: true },
  {
    key: "cnicFront",
    label: "CNIC / B-Form front",
    hint: "All four corners visible",
    required: true,
  },
  {
    key: "cnicBack",
    label: "CNIC / B-Form back",
    hint: "Both sides must be readable",
    required: true,
  },
  { key: "guardianCnic", label: "Guardian CNIC", hint: "Optional", required: false },
  {
    key: "proof",
    label: "Payment screenshot / student card",
    hint: "Optional",
    required: false,
  },
];

/**
 * Public one-time upload page the student opens from the WhatsApp link.
 * No app install and no login — the token in the real link scopes it to one resident.
 */
export default function StudentUploadPage() {
  const router = useRouter();
  const { data } = useHostel();
  const { toast } = useToast();
  const [uploaded, setUploaded] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  const requiredDone = ITEMS.filter((item) => item.required).every(
    (item) => uploaded[item.key],
  );
  const doneCount = ITEMS.filter((item) => item.required && uploaded[item.key]).length;

  const upload = (key: string) => {
    setBusy(key);
    setTimeout(() => {
      setBusy(null);
      setUploaded((current) => ({ ...current, [key]: true }));
    }, 850);
  };

  return (
    <main className="min-h-screen bg-white pb-28">
      <div className="flex items-center gap-2.5 border-b border-line bg-[#eff1f4] px-4 py-2.5">
        <span className="h-5 w-5 rounded-lg border border-line bg-white" />
        <span className="flex-1 truncate rounded-lg border border-line bg-white px-2.5 py-1.5 font-mono text-[11px] text-mut">
          hostelflow.pk/u/8F42QX
        </span>
      </div>

      <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-p text-[13px] font-extrabold text-white">
            H
          </span>
          <span className="text-[12.5px] font-extrabold">
            {data ? data.settings.name : "H-K Boys Hostel"}
          </span>
        </div>

        <h1 className="mt-4 text-xl font-extrabold leading-tight tracking-tight">
          Upload your documents
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-mut">
          Take clear photos of the documents below. Nothing to install, no password
          needed.
        </p>
        <p className="mt-3 rounded-xl bg-tint px-3.5 py-3 text-[11.5px] font-bold text-p">
          {doneCount} of 3 required documents uploaded
        </p>

        <div className="mt-3.5 flex flex-col gap-2.5">
          {ITEMS.map((item) => {
            const done = Boolean(uploaded[item.key]);
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-2xl border border-line p-3.5"
              >
                <span
                  className={
                    "flex items-center justify-center rounded-xl " +
                    (done ? "bg-okt text-ok" : "bg-[#eff1f4] text-mut")
                  }
                  style={{ height: 52, width: 52 }}
                >
                  {busy === item.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : done ? (
                    <Check className="h-5 w-5" strokeWidth={3} />
                  ) : (
                    <span className="font-mono text-[10px]">—</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-mut">
                    {busy === item.key
                      ? "Uploading ..."
                      : done
                        ? "Uploaded"
                        : "Not uploaded yet"}{" "}
                    · {item.hint}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => upload(item.key)}>
                  {done ? "Replace" : "Take photo"}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-3.5 text-[11px] leading-relaxed text-mut">
          Your documents go only to the hostel office and are stored with your resident
          file. The link expires in 24 hours.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white/97 px-4 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-[520px] gap-2.5">
          <Button variant="outline" size="lg" onClick={() => router.back()}>
            Close
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={sending}
            onClick={() => {
              if (!requiredDone) {
                toast("Upload your photo and both CNIC sides first");
                return;
              }
              setSending(true);
              setTimeout(() => {
                setSending(false);
                toast("Documents received — visible in the resident file");
                router.back();
              }, 900);
            }}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send to hostel
          </Button>
        </div>
      </div>
    </main>
  );
}
