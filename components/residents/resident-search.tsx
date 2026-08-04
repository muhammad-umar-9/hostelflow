"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function ResidentSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mut" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search name, CNIC, phone or room"
        className="pl-10"
        aria-label="Search residents"
      />
    </div>
  );
}
