import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eff1f4] text-mut">
        {Icon ? <Icon className="h-6 w-6" /> : null}
      </div>
      <p className="mt-3.5 text-sm font-bold">{title}</p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-mut">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
