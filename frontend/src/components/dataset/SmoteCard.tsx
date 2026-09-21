import { motion } from "framer-motion";
import { GitMerge, TrendingUp, FileOutput, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { PipelineActionCard } from "./PipelineActionCard";
import { StatTile } from "./StatTile";
import { safeNumber, safeString } from "../../utils/format";
import type { SmoteReport } from "../../types/dataset";

interface SmoteCardProps {
  onRun: () => void;
  loading: boolean;
  report: SmoteReport | null;
  locked: boolean;
}

export function SmoteCard({ onRun, loading, report, locked }: SmoteCardProps) {
  const fraudBefore = typeof report?.fraud_before === "number" ? report.fraud_before : 0;
  const fraudAfter = typeof report?.fraud_after === "number" ? report.fraud_after : 0;
  const maxFraud = Math.max(fraudBefore, fraudAfter, 1);
  const increase = typeof report?.percentage_increase === "number" ? report.percentage_increase : null;

  return (
    <PipelineActionCard
      icon={GitMerge}
      title="SMOTE Balancing"
      description="Synthetically balance the minority fraud class for better model recall."
      buttonLabel="Apply SMOTE"
      onRun={onRun}
      loading={loading}
      completed={!!report}
      locked={locked}
      lockedMessage="Run preprocessing before applying SMOTE."
      successMessage="SMOTE Applied Successfully"
    >
      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={TrendingUp} label="Rows Before" value={safeNumber(report.rows_before)} />
            <StatTile icon={TrendingUp} label="Rows After" value={safeNumber(report.rows_after)} />
            <StatTile icon={TrendingUp} label="Fraud Before" value={safeNumber(report.fraud_before)} />
            <StatTile icon={TrendingUp} label="Fraud After" value={safeNumber(report.fraud_after)} />
          </div>

          <div className="mt-4 rounded-xl border border-card-border/70 bg-bg/40 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-faint">Fraud Class — Before vs After</span>
              <span className="font-semibold text-success">{increase !== null ? `+${increase}%` : "—"}</span>
            </div>
            <div className="mt-3 space-y-2.5">
              <BarRow label="Before" value={fraudBefore} max={maxFraud} color="bg-secondary" />
              <BarRow label="After" value={fraudAfter} max={maxFraud} color="bg-primary" />
            </div>
          </div>

          {report.output_file && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-faint">
              <FileOutput size={13} /> Output: {safeString(report.output_file)}
            </div>
          )}
        </>
      )}
    </PipelineActionCard>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-faint">
        <span>{label}</span>
        <span>{value.toLocaleString()}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-card">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  );
}
