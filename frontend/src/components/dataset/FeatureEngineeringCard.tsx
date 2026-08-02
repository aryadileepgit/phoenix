import { motion } from "framer-motion";
import { Layers, Plus, FileOutput } from "lucide-react";
import { PipelineActionCard } from "./PipelineActionCard";
import { StatTile } from "./StatTile";
import { safeNumber, safeString, safeArray } from "../../utils/format";
import type { FeatureEngineeringReport } from "../../types/dataset";

interface FeatureEngineeringCardProps {
  onRun: () => void;
  loading: boolean;
  report: FeatureEngineeringReport | null;
  locked: boolean;
}

export function FeatureEngineeringCard({ onRun, loading, report, locked }: FeatureEngineeringCardProps) {
  const newFeaturesCreated = report?.new_features_created ?? 0;

  return (
    <PipelineActionCard
      icon={Layers}
      title="Feature Engineering"
      description="Derive new signal-rich features to improve model discrimination."
      buttonLabel="Generate Features"
      onRun={onRun}
      loading={loading}
      completed={!!report}
      locked={locked}
      lockedMessage="Apply SMOTE before generating features."
      successMessage="Feature Engineering Completed Successfully"
    >
      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile icon={Layers} label="Original Features" value={safeNumber(report.original_features)} />
            <StatTile icon={Layers} label="Engineered Features" value={safeNumber(report.engineered_features)} />
            <StatTile icon={Plus} label="New Features Added" value={newFeaturesCreated.toString()} />
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
