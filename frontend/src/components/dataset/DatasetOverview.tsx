import { motion } from "framer-motion";
import { Database, Hash, Rows3, Columns3, BadgeCheck, ShieldCheck, HardDrive, CalendarClock, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { safeString, safeNumber, safeBytes, safeDate, safeUpper } from "../../utils/format";
import type { DatasetInfo } from "../../types/dataset";

interface DatasetOverviewProps {
  dataset: DatasetInfo | null;
}

export function DatasetOverview({ dataset }: DatasetOverviewProps) {
  if (!dataset) return null;

  const statusUpper = safeUpper(dataset.validation?.validationStatus);
  const hasStatus = statusUpper.length > 0;
  const passed = statusUpper === "PASSED";

  const cards = [
    { icon: Database, label: "Dataset Name", value: safeString(dataset.datasetName), bg: "bg-secondary/10", color: "text-secondary" },
    { icon: Hash, label: "Dataset ID", value: safeString(dataset.id), bg: "bg-violet-500/10", color: "text-violet-400" },
    { icon: Rows3, label: "Rows", value: safeNumber(dataset.rows), bg: "bg-secondary/10", color: "text-secondary" },
    { icon: Columns3, label: "Columns", value: safeNumber(dataset.columns), bg: "bg-violet-500/10", color: "text-violet-400" },
    { icon: BadgeCheck, label: "Status", value: safeString(dataset.status), bg: "bg-success/10", color: "text-success" },
    {
      icon: ShieldCheck,
      label: "Validation Status",
      value: hasStatus ? (passed ? "Passed" : "Failed") : "Unknown",
      bg: !hasStatus ? "bg-card" : passed ? "bg-success/10" : "bg-danger/10",
      color: !hasStatus ? "text-faint" : passed ? "text-success" : "text-danger",
    },
    { icon: HardDrive, label: "File Size", value: safeBytes(dataset.fileSize), bg: "bg-warning/10", color: "text-warning" },
    { icon: CalendarClock, label: "Upload Date", value: safeDate(dataset.uploadTime), bg: "bg-secondary/10", color: "text-secondary" },
  ];

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-100">Dataset Information</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, bg, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            className="rounded-2xl border border-card-border bg-card p-4 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color}`}>
              <Icon size={16} />
            </div>
            <p className="mt-3 truncate text-xs text-muted">{label}</p>
            <p className="mt-1 truncate text-base font-bold text-slate-50" title={value}>
              {value}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
