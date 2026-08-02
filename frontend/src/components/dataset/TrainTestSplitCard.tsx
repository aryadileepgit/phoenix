import { motion } from "framer-motion";
import { SplitSquareHorizontal, Rows3, ListChecks, FolderOutput } from "lucide-react";
import { PipelineActionCard } from "./PipelineActionCard";
import { StatTile } from "./StatTile";
import { safeNumber, safeString, safePercent } from "../../utils/format";
import type { TrainTestSplitReport } from "../../types/dataset";

interface TrainTestSplitCardProps {
  onRun: () => void;
  loading: boolean;
  report: TrainTestSplitReport | null;
  locked: boolean;
}

export function TrainTestSplitCard({ onRun, loading, report, locked }: TrainTestSplitCardProps) {
  const trainPct = safePercent(report?.train_ratio);
  const testPct = safePercent(report?.test_ratio);

  return (
    <PipelineActionCard
      icon={SplitSquareHorizontal}
      title="Train / Test Split"
      description="Partition the engineered dataset into training and testing sets."
      buttonLabel="Prepare Training Dataset"
      onRun={onRun}
      loading={loading}
      completed={!!report}
      locked={locked}
      lockedMessage="Generate features before splitting the dataset."
      successMessage="Train / Test Split Completed Successfully"
    >
      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile icon={Rows3} label="Training Rows" value={safeNumber(report.training_rows)} />
            <StatTile icon={Rows3} label="Testing Rows" value={safeNumber(report.testing_rows)} />
            <StatTile icon={ListChecks} label="Total Features" value={safeNumber(report.total_features)} />
          </div>

          <div className="mt-4 space-y-3">
            <SplitBar label={`Train — ${trainPct}%`} pct={trainPct} color="bg-primary" />
            <SplitBar label={`Test — ${testPct}%`} pct={testPct} color="bg-secondary" />
          </div>

          {report.output_folder && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-faint">
              <FolderOutput size={13} /> Output folder: {safeString(report.output_folder)}
            </div>
          )}
        </>
      )}
    </PipelineActionCard>
  );
}

function SplitBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <p className="text-[11px] text-faint">{label}</p>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-bg">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }} className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  );
}
