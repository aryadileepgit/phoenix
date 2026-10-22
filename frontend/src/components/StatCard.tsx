import React, { type ComponentType } from "react";

interface StatCardProps {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  value: string | number;
  iconColor?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  iconColor = "#f97316",
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-600/50 bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-50">{value}</p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${iconColor}1A`, color: iconColor }}
        >
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}