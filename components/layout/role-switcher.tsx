"use client";

import { useRouter } from "next/navigation";
import { useHostel } from "@/components/providers/hostel-provider";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "resident", label: "Resident" },
];

export function RoleSwitcher({ className }: { className?: string }) {
  const { role, setRole } = useHostel();
  const router = useRouter();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-[10px] font-bold tracking-widest text-mut">DEMO ROLE</p>
      <div className="flex gap-1.5">
        {ROLES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setRole(item.value);
              router.push(item.value === "resident" ? "/resident-portal" : "/dashboard");
            }}
            className={cn(
              "flex-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition",
              role === item.value
                ? "border-p bg-p text-white"
                : "border-line bg-white text-mut hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
