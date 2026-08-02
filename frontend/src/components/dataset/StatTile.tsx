import type { LucideIcon } from "lucide-react";

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

/** Small labeled stat block reused across every pipeline stage result panel. */
export function StatTile({ icon: Icon, label, value }: StatTileProps) {
  return (
    <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-faint">
        <Icon size={12} />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-bold text-slate-100" title={value}>
        {value}
      </p>
    </div>
  );
}
