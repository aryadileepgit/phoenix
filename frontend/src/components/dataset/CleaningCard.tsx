import { Sparkles, Rows3, Copy, AlertTriangle, FileOutput } from "lucide-react";
import { PipelineActionCard } from "./PipelineActionCard";
import { StatTile } from "./StatTile";
import { safeNumber, safeString } from "../../utils/format";
import type { CleaningReport } from "../../types/dataset";

interface CleaningCardProps {
  onRun: () => void;
  loading: boolean;
  report: CleaningReport | null;
  locked: boolean;
}

export function CleaningCard({ onRun, loading, report, locked }: CleaningCardProps) {
  return (
    <PipelineActionCard
      icon={Sparkles}
      title="Data Cleaning"
      description="Remove duplicates, fix missing values, and normalize the raw dataset."
      buttonLabel="Clean Dataset"
      onRun={onRun}
      loading={loading}
      completed={!!report}
      locked={locked}
      lockedMessage="Upload and validate a dataset first."
      successMessage="Cleaning Completed Successfully"
    >
      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Rows3} label="Rows Before" value={safeNumber(report.rows_before)} />
            <StatTile icon={Rows3} label="Rows After" value={safeNumber(report.rows_after)} />
            <StatTile icon={Copy} label="Duplicates Removed" value={safeNumber(report.duplicates_removed)} />
            <StatTile icon={AlertTriangle} label="Missing Fixed" value={safeNumber(report.missing_values_fixed)} />
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
