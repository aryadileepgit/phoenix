import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Database, Gauge, Clock } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { ModelPerformanceCard } from "../components/fraud/ModelPerformanceCard";
import { TransactionUploadCard } from "../components/fraud/TransactionUploadCard";
import { BatchResultsPanel } from "../components/fraud/BatchResultsPanel";
import { getLatestDatasetStatus, predictTransactionsBatch } from "../services/fraudDetectionService";
import { safeString, safeDate } from "../utils/format";
import type { LatestDatasetStatus, BatchPredictionResult } from "../types/fraud";

interface FraudDetectionProps {
  onLogout: () => void;
}

export function FraudDetection({ onLogout }: FraudDetectionProps) {
  const [status, setStatus] = useState<LatestDatasetStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchPredictionResult | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const latest = await getLatestDatasetStatus();
      setStatus(latest);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to load fraud detection status.");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const datasetId = status?.model ? status.dataset.id : null;

  const handleAnalyze = async (file: File) => {
    if (!datasetId || analyzing) return;

    setAnalyzing(true);
    setAnalyzeError(null);
    setUploadProgress(0);
    setResult(null);

    try {
      const batchResult = await predictTransactionsBatch(datasetId, file, setUploadProgress);
      setResult(batchResult);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <AppShell onLogout={onLogout}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Fraud Detection</h1>
          <p className="mt-1 text-sm text-muted">
            Upload transaction data and let the trained model analyze it for fraud.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <HeaderStat
            icon={Database}
            label="Dataset"
            value={status ? safeString(status.dataset.dataset_name) : "—"}
          />
          <HeaderStat
            icon={Gauge}
            label="Model Status"
            value={status?.model ? safeString(status.model.status) : "No Model"}
          />
          <HeaderStat
            icon={Clock}
            label="Last Updated"
            value={status?.model?.created_at ? safeDate(status.model.created_at) : "—"}
          />
        </div>
      </motion.div>

      {/* Model performance */}
      <ModelPerformanceCard status={status} loading={statusLoading} error={statusError} onRetry={loadStatus} />

      {/* Upload + analyze */}
      <TransactionUploadCard
        datasetId={datasetId}
        onAnalyze={handleAnalyze}
        analyzing={analyzing}
        uploadProgress={uploadProgress}
        error={analyzeError}
      />

      {/* Results */}
      {result && <BatchResultsPanel result={result} />}
    </AppShell>
  );
}

function HeaderStat({ icon: Icon, label, value }: { icon: typeof ShieldAlert; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-card-border bg-card px-3.5 py-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[10px] text-faint">{label}</p>
        <p className="max-w-[9rem] truncate text-xs font-semibold text-slate-100" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default FraudDetection;
