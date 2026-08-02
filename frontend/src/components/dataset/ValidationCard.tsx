import { motion } from "framer-motion";
import { CheckCircle2, XCircle, FileCheck2, ListChecks, AlertTriangle, Copy, ShieldQuestion } from "lucide-react";
import { safeBool, safeNumber, safeUpper, safeArray } from "../../utils/format";
import type { ValidationReport } from "../../types/dataset";

interface ValidationCardProps {
  validation: ValidationReport | null;
}

export function ValidationCard({ validation }: ValidationCardProps) {
  if (!validation) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-6">
        <h2 className="text-sm font-semibold text-slate-100">Validation Report</h2>
        <p className="mt-4 text-sm text-faint">Validation results will appear after upload.</p>
      </div>
    );
  }

  const csvFormatValid = safeBool(validation.csvFormatValid);
  const requiredColumnsPresent = safeBool(validation.requiredColumnsPresent);
  const missingValues = typeof validation.missingValues === "number" ? validation.missingValues : null;
  const duplicateRows = typeof validation.duplicateRows === "number" ? validation.duplicateRows : null;
  const missingColumns = safeArray<string>(validation.missingColumns);
  const statusUpper = safeUpper(validation.validationStatus);
  const passed = statusUpper === "PASSED";
  const hasStatus = statusUpper.length > 0;

  const checks = [csvFormatValid, requiredColumnsPresent, missingValues === 0, duplicateRows === 0];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const rows = [
    { icon: FileCheck2, label: "CSV Format", value: csvFormatValid ? "Valid" : "Invalid", ok: csvFormatValid },
    {
      icon: ListChecks,
      label: "Required Columns",
      value: requiredColumnsPresent ? "All Present" : "Missing Columns",
      ok: requiredColumnsPresent,
    },
    { icon: AlertTriangle, label: "Missing Values", value: safeNumber(missingValues, "N/A"), ok: missingValues === 0 },
    { icon: Copy, label: "Duplicate Rows", value: safeNumber(duplicateRows, "N/A"), ok: duplicateRows === 0 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-card-border bg-card p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Validation Report</h2>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            !hasStatus
              ? "border-card-border bg-card text-faint"
              : passed
              ? "border-success/25 bg-success/10 text-success"
              : "border-danger/25 bg-danger/10 text-danger"
          }`}
        >
          {hasStatus ? passed ? <CheckCircle2 size={13} /> : <XCircle size={13} /> : null}
          {hasStatus ? (passed ? "PASSED" : "FAILED") : "UNKNOWN"}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-faint">
          <span className="flex items-center gap-1.5">
            <ShieldQuestion size={13} /> Data Quality Score
          </span>
          <span className="font-semibold text-slate-200">{score}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.6 }}
            className={`h-full rounded-full ${score === 100 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-danger"}`}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map(({ icon: Icon, label, value, ok }) => (
          <div key={label} className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-faint">
              <Icon size={13} />
              {label}
            </div>
            <span className={`flex items-center gap-1 text-sm font-semibold ${ok ? "text-success" : "text-danger"}`}>
              {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {value}
            </span>
          </div>
        ))}
      </div>

      {!requiredColumnsPresent && missingColumns.length > 0 && (
        <div className="mt-4 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs text-danger">
          Missing columns: {missingColumns.join(", ")}
        </div>
      )}
    </motion.div>
  );
}
