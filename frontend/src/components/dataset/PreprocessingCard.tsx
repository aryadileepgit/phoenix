import { SlidersHorizontal, Scaling, Rows3, FileOutput, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { PipelineActionCard } from "./PipelineActionCard";
import { StatTile } from "./StatTile";
import { safeNumber, safeString } from "../../utils/format";
import type { PreprocessingReport } from "../../types/dataset";

interface PreprocessingCardProps {
  onRun: () => void;
  loading: boolean;
  report: PreprocessingReport | null;
  locked: boolean;
}

export function PreprocessingCard({ onRun, loading, report, locked }: PreprocessingCardProps) {
  return (
    <PipelineActionCard
      icon={SlidersHorizontal}
      title="Preprocessing"
      description="Encode categorical fields and scale numerical features for modeling."
      buttonLabel="Run Preprocessing"
      onRun={onRun}
      loading={loading}
      completed={!!report}
      locked={locked}
      lockedMessage="Clean the dataset before preprocessing."
      successMessage="Preprocessing Completed Successfully"
    >
      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            
            <StatTile icon={Scaling} label="Numerical Scaled" value={safeNumber(report.numerical_scaled)} />
            <StatTile icon={Rows3} label="Rows Processed" value={safeNumber(report.rows_processed)} />
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
