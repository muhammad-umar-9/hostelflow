import Link from "next/link";
import { BedDouble, MessageSquare, UserPlus, Wallet } from "lucide-react";

const ACTIONS = [
  { href: "/admissions/new", label: "Add Resident", urdu: "نیا رہائشی", icon: UserPlus },
  {
    href: "/rooms?filter=vacant",
    label: "Allocate Bed",
    urdu: "بیڈ دیں",
    icon: BedDouble,
  },
  { href: "/payments", label: "Record Payment", urdu: "ادائیگی", icon: Wallet },
  {
    href: "/payments?filter=overdue",
    label: "Send Reminders",
    urdu: "یاد دہانی",
    icon: MessageSquare,
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col gap-2.5 rounded-2xl border border-line bg-white p-3.5 transition hover:border-p/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-tint text-p">
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[13px] font-bold">{action.label}</span>
              <span className="mt-0.5 block font-urdu text-[10px] leading-[2.3] text-mut">
                {action.urdu}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
