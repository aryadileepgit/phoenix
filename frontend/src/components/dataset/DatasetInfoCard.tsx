import { motion } from "framer-motion";
import { Database, FileText, Rows3, Columns3, BadgeCheck, Clock } from "lucide-react";
import type { DatasetInfo } from "../../types/dataset";

interface DatasetInfoCardProps {
  dataset: DatasetInfo | null;
}

function formatUploadTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function DatasetInfoCard({ dataset }: DatasetInfoCardProps) {
  if (!dataset) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-6">
        <h2 className="text-sm font-semibold text-slate-100">Dataset Information</h2>
        <p className="mt-4 text-sm text-faint">Upload a dataset to see its details here.</p>
      </div>
    );
  }

  const items = [
    { icon: Database, label: "Dataset Name", value: dataset.datasetName },
    { icon: FileText, label: "Original Filename", value: dataset.originalFilename },
    { icon: Rows3, label: "Rows", value: dataset.rows?.toLocaleString() ?? "—" },
    { icon: Columns3, label: "Columns", value: dataset.columns?.toString() ?? "—" },
    { icon: BadgeCheck, label: "Upload Status", value: dataset.status },
    { icon: Clock, label: "Upload Time", value: dataset.uploadTime ? formatUploadTime(dataset.uploadTime) : "—" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-card-border bg-card p-6"
    >
      <h2 className="text-sm font-semibold text-slate-100">Dataset Information</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-card-border/70 bg-bg/40 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-faint">
              <Icon size={13} />
              {label}
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold text-slate-100">{value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
