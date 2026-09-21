import { motion } from "framer-motion";
import { Rows3, Columns3, AlertCircle, Copy, BadgeCheck, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import type { DatasetInfo, ValidationReport } from "../../types/dataset";

interface StatisticsCardsProps {
  dataset: DatasetInfo | null;
  validation: ValidationReport | null;
}

export function StatisticsCards({ dataset, validation }: StatisticsCardsProps) {
  if (!dataset || !validation) return null;

  // Safe check for validation status
  const status = validation?.validationStatus?.toUpperCase() ?? "UNKNOWN";
  const passed = status === "PASSED";

  const cards = [
    {
      icon: Rows3,
      label: "Total Rows",
      value: dataset?.rows?.toLocaleString?.() ?? "0",
      bg: "bg-secondary/10",
      color: "text-secondary",
    },
    {
      icon: Columns3,
      label: "Total Columns",
      value: dataset?.columns?.toString?.() ?? "0",
      bg: "bg-violet-500/10",
      color: "text-violet-400",
    },
    {
      icon: AlertCircle,
      label: "Missing Values",
      value: validation?.missingValues?.toLocaleString?.() ?? "0",
      bg: "bg-warning/10",
      color: "text-warning",
    },
    {
      icon: Copy,
      label: "Duplicate Rows",
      value: validation?.duplicateRows?.toLocaleString?.() ?? "0",
      bg: "bg-danger/10",
      color: "text-danger",
    },
    {
      icon: BadgeCheck,
      label: "Validation Status",
      value: passed ? "Passed" : "Failed",
      bg: passed ? "bg-success/10" : "bg-danger/10",
      color: passed ? "text-success" : "text-danger",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map(({ icon: Icon, label, value, bg, color }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
          className="rounded-2xl border border-card-border bg-card p-5"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color}`}>
            <Icon size={18} />
          </div>
          <p className="mt-3 text-xs text-muted">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-50">{value}</p>
        </motion.div>
      ))}
    </div>
  );
}
