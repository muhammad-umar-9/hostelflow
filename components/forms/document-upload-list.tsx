"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DocumentItem {
  key: string;
  label: string;
  requirement: "Required" | "Optional";
  hint?: string;
}

interface DocumentUploadListProps {
  items: DocumentItem[];
  values: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
  waitingLabel?: string;
}

export function DocumentUploadList({
  items,
  values,
  onChange,
  waitingLabel,
}: DocumentUploadListProps) {
  const [uploading, setUploading] = React.useState<string | null>(null);

  const upload = (key: string) => {
    if (values[key]) {
      onChange(key, false);
      return;
    }
    setUploading(key);
    setTimeout(() => {
      setUploading(null);
      onChange(key, true);
    }, 850);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const done = Boolean(values[item.key]);
        const busy = uploading === item.key;
        return (
          <div
            key={item.key}
            className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5"
          >
            <div
              className={
                "flex shrink-0 items-center justify-center rounded-xl " +
                (done ? "bg-okt text-ok" : "bg-[#eff1f4] text-mut")
              }
              style={{ height: 52, width: 52 }}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : done ? (
                <Check className="h-5 w-5" strokeWidth={3} />
              ) : (
                <span className="font-mono text-[10px]">no file</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold">{item.label}</p>
              <p className="mt-0.5 text-[11px] text-mut">
                {item.requirement} ·{" "}
                {busy
                  ? "Uploading ..."
                  : done
                    ? "Uploaded"
                    : waitingLabel || "Camera or gallery"}
                {item.hint ? " · " + item.hint : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" type="button" onClick={() => upload(item.key)}>
              {done ? "Replace" : "Upload"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
