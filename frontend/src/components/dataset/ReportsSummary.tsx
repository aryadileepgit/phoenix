import { motion } from "framer-motion";
import { CheckCircle2, Circle, Sparkles, SlidersHorizontal, GitMerge, Layers, SplitSquareHorizontal } from "lucide-react";
import { safeNumber } from "../../utils/format";
import type {
  CleaningReport,
  PreprocessingReport,
  SmoteReport,
  FeatureEngineeringReport,
  TrainTestSplitReport,
} from "../../types/dataset";

interface ReportsSummaryProps {
  cleaning: CleaningReport | null;
  preprocessing: PreprocessingReport | null;
  smote: SmoteReport | null;
  featureEngineering: FeatureEngineeringReport | null;
  split: TrainTestSplitReport | null;
}

/** Compact bird's-eye recap of every pipeline report, once they exist. */
export function ReportsSummary({ cleaning, preprocessing, smote, featureEngineering, split }: ReportsSummaryProps) {
  const rows = [
    {
      icon: Sparkles,
      label: "Cleaning",
      done: !!cleaning,
      summary: cleaning ? `${safeNumber(cleaning.duplicates_removed)} duplicates removed` : "Not run yet",
    },
    {
      icon: SlidersHorizontal,
      label: "Preprocessing",
      done: !!preprocessing,
      summary: preprocessing ? `${safeNumber(preprocessing.rows_processed)} rows processed` : "Not run yet",
    },
    {
      icon: GitMerge,
      label: "SMOTE",
      done: !!smote,
      summary: smote ? `${safeNumber(smote.fraud_after)} fraud rows after balancing` : "Not run yet",
    },
    {
      icon: Layers,
      label: "Feature Engineering",
      done: !!featureEngineering,
      summary: featureEngineering
        ? `${safeNumber(featureEngineering.engineered_features)} engineered features`
        : "Not run yet",
    },
    {
      icon: SplitSquareHorizontal,
      label: "Train / Test Split",
      done: !!split,
      summary: split ? `${safeNumber(split.training_rows)} training rows` : "Not run yet",
    },
  ];

  return (
    <div className="rounded-2xl border border-card-border bg-card p-6">
      <h2 className="text-sm font-semibold text-slate-100">Reports</h2>
      <p className="mt-1 text-xs text-faint">A quick recap of every stage report generated so far.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map(({ icon: Icon, label, done, summary }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className={`rounded-xl border p-4 ${
              done ? "border-success/25 bg-success/5" : "border-card-border bg-bg/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${done ? "bg-success/10 text-success" : "bg-card text-faint"}`}>
                <Icon size={15} />
              </div>
              {done ? <CheckCircle2 size={15} className="text-success" /> : <Circle size={15} className="text-faint" />}
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-100">{label}</p>
            <p className="mt-1 truncate text-[11px] text-faint" title={summary}>
              {summary}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
