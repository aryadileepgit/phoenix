import { Rows3, ListChecks, FolderOutput, SplitSquareHorizontal } from "lucide-react";
import { PipelineActionCard } from "./PipelineActionCard";
import { StatTile } from "./StatTile";
import { safeNumber, safeString } from "../../utils/format";
import type { TrainTestSplitReport } from "../../types/dataset";

interface TrainTestSplitCardProps {
  onRun: () => void;
  loading: boolean;
  report: TrainTestSplitReport | null;
  locked: boolean;
}

export function TrainTestSplitCard({
  onRun,
  loading,
  report,
  locked,
}: TrainTestSplitCardProps) {
  return (
    <PipelineActionCard
      icon={SplitSquareHorizontal}
      title="Train / Test Split"
      description="Partition the engineered dataset into training and testing datasets."
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
            <StatTile
              icon={Rows3}
              label="Training Rows"
              value={safeNumber(report.training_rows)}
            />

            <StatTile
              icon={Rows3}
              label="Testing Rows"
              value={safeNumber(report.testing_rows)}
            />

            <StatTile
              icon={ListChecks}
              label="Total Features"
              value={safeNumber(report.total_features)}
            />
          </div>

          <div className="mt-4 rounded-xl border border-card-border bg-bg/50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-faint">Split Ratio</span>
              <span className="font-semibold text-slate-200">
                80% Training / 20% Testing
              </span>
            </div>
          </div>

          {report.output_folder && (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-faint">
              <FolderOutput size={13} />
              Output Folder: {safeString(report.output_folder)}
            </div>
          )}
        </>
      )}
    </PipelineActionCard>
  );
}