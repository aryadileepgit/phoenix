import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  UploadCloud,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  GitMerge,
  Layers,
  SplitSquareHorizontal,
  Rocket,
  Clock,
  Activity as ActivityIcon,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { UploadCard } from "../components/dataset/UploadCard";
import { DatasetOverview } from "../components/dataset/DatasetOverview";
import { ValidationCard } from "../components/dataset/ValidationCard";
import { CleaningCard } from "../components/dataset/CleaningCard";
import { PreprocessingCard } from "../components/dataset/PreprocessingCard";
import { SmoteCard } from "../components/dataset/SmoteCard";
import { FeatureEngineeringCard } from "../components/dataset/FeatureEngineeringCard";
import { TrainTestSplitCard } from "../components/dataset/TrainTestSplitCard";
import { StorageFlow } from "../components/dataset/StorageFlow";
import { ActivityTimeline, type ActivityEntry } from "../components/dataset/ActivityTimeline";
import { FooterSummary } from "../components/dataset/FooterSummary";
import { ReportsSummary } from "../components/dataset/ReportsSummary";
import { DatasetHistory } from "../components/dataset/DatasetHistory";
import { PipelineProgress, type Stage, type StageStatus } from "../components/dataset/PipelineProgress";
import { safeUpper } from "../utils/format";
import {
  uploadDataset,
  cleanDataset,
  preprocessDataset,
  applySmote,
  generateFeatures,
  splitTrainTest,
  getDatasetHistory,
  getDatasetById,
} from "../services/datasetService";
import type {
  DatasetInfo,
  ValidationReport,
  CleaningReport,
  PreprocessingReport,
  SmoteReport,
  FeatureEngineeringReport,
  TrainTestSplitReport,
  DatasetHistoryItem,
} from "../types/dataset";

interface DatasetProps {
  onLogout: () => void;
}

function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Dataset({ onLogout }: DatasetProps) {
  // Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pipeline stage reports
  const [cleaning, setCleaning] = useState(false);
  const [cleaningReport, setCleaningReport] = useState<CleaningReport | null>(null);

  const [preprocessing, setPreprocessing] = useState(false);
  const [preprocessingReport, setPreprocessingReport] = useState<PreprocessingReport | null>(null);

  const [smoteLoading, setSmoteLoading] = useState(false);
  const [smoteReport, setSmoteReport] = useState<SmoteReport | null>(null);

  const [featureLoading, setFeatureLoading] = useState(false);
  const [featureReport, setFeatureReport] = useState<FeatureEngineeringReport | null>(null);

  const [splitLoading, setSplitLoading] = useState(false);
  const [splitReport, setSplitReport] = useState<TrainTestSplitReport | null>(null);

  // Activity log — real entries pushed as each pipeline action actually completes.
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const logActivity = useCallback((label: string) => {
    setActivity((prev) => [...prev, { time: timeNow(), label }]);
  }, []);

  // Dataset history — backed by GET /dataset/history.
  const [historyItems, setHistoryItems] = useState<DatasetHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await getDatasetHistory();
      setHistoryItems(items);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load dataset history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // -----------------------------
  // Upload Dataset
  // -----------------------------
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(false);

    try {
      const response = await uploadDataset(
        selectedFile,
        setUploadProgress
      );

      // IMPORTANT
      setDataset(response.dataset);

      // Validation
      setValidation(response.dataset.validation ?? null);

      setSuccess(true);

      // Refresh history so the newly uploaded dataset appears in the table.
      refreshHistory();

      // Reset pipeline
      setCleaningReport(null);
      setPreprocessingReport(null);
      setSmoteReport(null);
      setFeatureReport(null);
      setSplitReport(null);

      logActivity(
        `Uploaded dataset "${response.dataset.datasetName ?? response.dataset.originalFilename ?? "Dataset"}"`
      );

      const statusUpper = safeUpper(
        response.dataset.validation?.validationStatus
      );

      logActivity(
        statusUpper.length === 0
          ? "Validation completed"
          : statusUpper === "PASSED"
          ? "Validation completed — PASSED"
          : "Validation completed — FAILED"
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setSelectedFile(null);
    }
  };

  // -----------------------------
  // Clean Dataset
  // -----------------------------
  const handleClean = async () => {
    if (!dataset || cleaning) return;
    setCleaning(true);
    setError(null);
    try {
      const response = await cleanDataset(dataset.id);
      setCleaningReport(response.cleaning);
      logActivity("Cleaning completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleaning failed.");
    } finally {
      setCleaning(false);
    }
  };

  // -----------------------------
  // Preprocess Dataset
  // -----------------------------
  const handlePreprocess = async () => {
    if (!dataset || preprocessing) return;
    setPreprocessing(true);
    setError(null);
    try {
      const response = await preprocessDataset(dataset.id);
      setPreprocessingReport(response.preprocessing);
      logActivity("Preprocessing completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preprocessing failed.");
    } finally {
      setPreprocessing(false);
    }
  };

  // -----------------------------
  // Apply SMOTE
  // -----------------------------
  const handleSmote = async () => {
    if (!dataset || smoteLoading) return;
    setSmoteLoading(true);
    setError(null);
    try {
      const response = await applySmote(dataset.id);
      setSmoteReport(response.smote);
      logActivity("SMOTE applied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SMOTE failed.");
    } finally {
      setSmoteLoading(false);
    }
  };

  // -----------------------------
  // Generate Features
  // -----------------------------
  const handleFeatures = async () => {
    if (!dataset || featureLoading) return;
    setFeatureLoading(true);
    setError(null);
    try {
      const response = await generateFeatures(dataset.id);
      setFeatureReport(response.feature_engineering);
      logActivity("Feature engineering completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feature engineering failed.");
    } finally {
      setFeatureLoading(false);
    }
  };

  // -----------------------------
  // Train/Test Split
  // -----------------------------
  const handleSplit = async () => {
    if (!dataset || splitLoading) return;
    setSplitLoading(true);
    setError(null);
    try {
      const response = await splitTrainTest(dataset.id);
      setSplitReport(response.training);
      logActivity("Training dataset created");
      logActivity("Train/Test split completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Train/Test split failed.");
    } finally {
      setSplitLoading(false);
    }
  };

  // -----------------------------
  // Select a dataset from history
  // -----------------------------
  const [historySelecting, setHistorySelecting] = useState(false);

  const handleSelectHistory = async (id: string) => {
    if (historySelecting || uploading) return;
    setHistorySelecting(true);
    setError(null);
    try {
      const loaded = await getDatasetById(id);
      setDataset(loaded);
      setValidation(loaded.validation ?? null);
      setSuccess(true);

      // A different dataset means the previous pipeline results no longer apply.
      setCleaningReport(null);
      setPreprocessingReport(null);
      setSmoteReport(null);
      setFeatureReport(null);
      setSplitReport(null);

      logActivity(`Loaded dataset "${loaded.datasetName ?? loaded.originalFilename ?? loaded.id}" from history`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dataset.");
    } finally {
      setHistorySelecting(false);
    }
  };

  // -----------------------------
  // Derived pipeline stage state
  // -----------------------------
  const statusFor = (loading: boolean, done: boolean): StageStatus =>
    loading ? "running" : done ? "completed" : "pending";

  const stages: Stage[] = [
    { key: "upload", label: "Dataset Upload", icon: UploadCloud, status: statusFor(uploading, !!dataset) },
    { key: "validation", label: "Validation", icon: ShieldCheck, status: statusFor(uploading, !!validation) },
    { key: "cleaning", label: "Cleaning", icon: Sparkles, status: statusFor(cleaning, !!cleaningReport) },
    { key: "preprocessing", label: "Preprocessing", icon: SlidersHorizontal, status: statusFor(preprocessing, !!preprocessingReport) },
    { key: "smote", label: "SMOTE", icon: GitMerge, status: statusFor(smoteLoading, !!smoteReport) },
    { key: "features", label: "Feature Engineering", icon: Layers, status: statusFor(featureLoading, !!featureReport) },
    { key: "split", label: "Train/Test Split", icon: SplitSquareHorizontal, status: statusFor(splitLoading, !!splitReport) },
    { key: "ready", label: "Ready for Training", icon: Rocket, status: splitReport ? "completed" : "pending" },
  ];

  const completedActionStages = [dataset, cleaningReport, preprocessingReport, smoteReport, featureReport, splitReport].filter(
    Boolean
  ).length;
  const completionPct = Math.round((completedActionStages / 6) * 100);

  const storageActiveIndex = splitReport
    ? 5
    : featureReport
    ? 4
    : smoteReport
    ? 3
    : preprocessingReport
    ? 2
    : cleaningReport
    ? 1
    : dataset
    ? 0
    : -1;

  const currentStageLabel = stages.find((s) => s.status !== "completed")?.label ?? "Ready for Training";
  const lastUpdated = activity.length > 0 ? activity[activity.length - 1].time : "—";

  // -----------------------------
  // Proceed handler
  // -----------------------------
  const handleProceed = () => {
    logActivity("Requested to proceed to Model Training");
    // You can add navigation logic here
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
          <h1 className="text-2xl font-bold text-slate-50">Dataset Management</h1>
          <p className="mt-1 text-sm text-muted">
            Upload, validate and prepare transaction datasets for the fraud detection pipeline.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <HeaderStat icon={ShieldCheck} label="Dataset Status" value={dataset?.status ?? "No Dataset"} />
          <HeaderStat icon={ActivityIcon} label="Pipeline Stage" value={currentStageLabel} />
          <HeaderStat icon={Clock} label="Last Updated" value={lastUpdated} />
        </div>
      </motion.div>

      {/* Upload */}
      <UploadCard
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        onUpload={handleUpload}
        uploading={uploading}
        uploadProgress={uploadProgress}
        error={error}
        success={success}
        dataset={dataset}
      />

      {/* Dataset information */}
      <DatasetOverview dataset={dataset} />

      {/* Validation */}
      <ValidationCard validation={validation} />

      {/* Pipeline progress — centerpiece */}
      <PipelineProgress stages={stages} />

      {/* Cleaning */}
      <CleaningCard onRun={handleClean} loading={cleaning} report={cleaningReport} locked={!dataset} />

      {/* Preprocessing */}
      <PreprocessingCard onRun={handlePreprocess} loading={preprocessing} report={preprocessingReport} locked={!cleaningReport} />

      {/* SMOTE */}
      <SmoteCard onRun={handleSmote} loading={smoteLoading} report={smoteReport} locked={!preprocessingReport} />

      {/* Feature engineering */}
      <FeatureEngineeringCard onRun={handleFeatures} loading={featureLoading} report={featureReport} locked={!smoteReport} />

      {/* Train/test split */}
      <TrainTestSplitCard onRun={handleSplit} loading={splitLoading} report={splitReport} locked={!featureReport} />

      {/* Reports recap */}
      <ReportsSummary
        cleaning={cleaningReport}
        preprocessing={preprocessingReport}
        smote={smoteReport}
        featureEngineering={featureReport}
        split={splitReport}
      />

      {/* Storage flow */}
      <StorageFlow activeIndex={storageActiveIndex} />

      {/* Dataset history */}
      <DatasetHistory
        items={historyItems}
        loading={historyLoading}
        error={historyError}
        onSelect={handleSelectHistory}
      />

      {/* Activity timeline */}
      <ActivityTimeline entries={activity} />

      {/* Footer summary */}
      <FooterSummary
        completionPct={completionPct}
        datasetsProcessed={historyItems.length}
        ready={!!splitReport}
        onProceed={handleProceed}
      />
    </AppShell>
  );
}

function HeaderStat({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
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

export default Dataset;