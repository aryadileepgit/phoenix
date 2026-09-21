import { useCallback, useEffect, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import {
  UploadCloud,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  SlidersHorizontal,
  GitMerge,
  Layers,
  Rocket,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  BarChart3,
  TrendingUp,
  User,
  RefreshCw,
  Database,
} from "lucide-react";

import { AppShell } from "../components/layout/AppShell";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import {
  getDatasetOverview,
  getPipelineStages,
  getDatasetStatistics,
  getTrainedModel,
  runCleaning,
  runFeatureEngineering,
  runPreprocessing,
  runBalanceDataset,
} from "../services/datasetOverviewService";

import type {
  DatasetOverviewData,
  PipelineStage,
  DatasetStatistics,
  TrainedModelInfo,
} from "../types/datasetOverview";

/* ============================================================
   CONSTANTS
============================================================ */

const PIPELINE_STAGES_ORDER = [
  {
    key: "raw",
    label: "RAW DATA",
    icon: UploadCloud,
  },
  {
    key: "cleaning",
    label: "CLEANING",
    icon: Sparkles,
  },
  {
    key: "featureEngineering",
    label: "FEATURE ENGINEERING",
    icon: Layers,
  },
  {
    key: "preprocessing",
    label: "PREPROCESSING",
    icon: SlidersHorizontal,
  },
  {
    key: "smote",
    label: "SMOTE",
    icon: GitMerge,
  },
  {
    key: "training",
    label: "MODEL TRAINING",
    icon: Rocket,
  },
];

/* ============================================================
   HELPERS
============================================================ */

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

/* ============================================================
   STAT TILE
============================================================ */

function StatTile({
  icon: Icon,
  label,
  value,
  iconColor = "#f97316",
}: {
  icon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  label: string;
  value: string | number;
  iconColor?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-600/50 bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{label}</p>

          <p className="mt-1 truncate text-2xl font-bold text-slate-50">
            {value}
          </p>
        </div>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${iconColor}1A`,
            color: iconColor,
          }}
        >
          <Icon size={19} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PIPELINE STAGE CARD
============================================================ */

function StageCard({
  stage,
  stageIcon: StageIcon,
  isRunning,
}: {
  stage: PipelineStage;
  stageIcon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  isRunning: boolean;
}) {
  const status = stage.status;

  const statusStyles = {
    pending:
      "text-slate-500 bg-slate-500/10 border-slate-500/25",

    running:
      "text-primary bg-primary/10 border-primary/25",

    completed:
      "text-success bg-success/10 border-success/25",

    error:
      "text-danger bg-danger/10 border-danger/25",
  };

  const statusIcon = {
    pending: (
      <Clock
        size={13}
        className="text-slate-500"
      />
    ),

    running: (
      <Loader2
        size={13}
        className="animate-spin text-primary"
      />
    ),

    completed: (
      <CheckCircle2
        size={13}
        className="text-success"
      />
    ),

    error: (
      <XCircle
        size={13}
        className="text-danger"
      />
    ),
  };

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-bg/40 p-4 transition-all ${
        status === "running"
          ? "border-primary/40 shadow-lg shadow-primary/5"
          : "border-card-border/70"
      }`}
    >
      {/* Icon */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          status === "completed"
            ? "bg-success/10 text-success"
            : status === "running"
              ? "bg-primary/10 text-primary"
              : status === "error"
                ? "bg-danger/10 text-danger"
                : "bg-primary/10 text-primary"
        }`}
      >
        <StageIcon
          size={18}
          strokeWidth={2}
        />
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-200">
          {stage.label}
        </p>

        {stage.timestamp && (
          <p className="mt-0.5 text-[10px] text-faint">
            {stage.timestamp}
          </p>
        )}

        {stage.details && (
          <p className="truncate text-[10px] text-slate-500">
            {stage.details}
          </p>
        )}
      </div>

      {/* Status */}
      <span
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusStyles[status]} ${
          isRunning ? "animate-pulse" : ""
        }`}
      >
        {statusIcon[status]}

        {status.charAt(0).toUpperCase() +
          status.slice(1)}
      </span>
    </div>
  );
}

/* ============================================================
   PIPELINE ARROW
============================================================ */

function PipelineArrow({
  isLast,
}: {
  isLast: boolean;
}) {
  if (isLast) {
    return null;
  }

  return (
    <div className="hidden shrink-0 items-center justify-center text-slate-600 md:flex">
      <div className="h-5 w-px bg-slate-700" />
    </div>
  );
}

/* ============================================================
   LOADING SKELETON
============================================================ */

function LoadingSkeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-slate-700/60 ${className}`}
    />
  );
}

/* ============================================================
   MAIN PAGE
============================================================ */

export function Dataset({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const [overview, setOverview] =
    useState<DatasetOverviewData | null>(null);

  const [pipelineStages, setPipelineStages] =
    useState<PipelineStage[]>([]);

  const [statistics, setStatistics] =
    useState<DatasetStatistics | null>(null);

  const [model, setModel] =
    useState<TrainedModelInfo | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [statsLoading, setStatsLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [statsError, setStatsError] =
    useState<string | null>(null);

  const [modelError, setModelError] =
    useState<string | null>(null);

  const [runningAction, setRunningAction] =
    useState<string | null>(null);

  /* ==========================================================
     LOAD DATA
  ========================================================== */

  const loadData = useCallback(async () => {
    setError(null);
    setStatsError(null);
    setModelError(null);

    // ------------------------------------------------------
    // First paint: lightweight metadata only (overview file
    // stats are cached backend-side; stages are existence
    // checks; model info is a single DB row). The heavy
    // 590k-row statistics payload loads deferred below and
    // never blocks first paint. Nothing here runs any
    // pipeline stage automatically.
    // ------------------------------------------------------

    try {
      const [
        overviewData,
        stagesData,
        modelData,
      ] = await Promise.all([
        getDatasetOverview(),
        getPipelineStages(),
        getTrainedModel().catch((err) => {
          setModelError(
            err instanceof Error
              ? err.message
              : "Failed to load trained model information."
          );
          return null;
        }),
      ]);

      setOverview(overviewData);
      setPipelineStages(stagesData);
      setModel(modelData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dataset data."
      );
    } finally {
      setLoading(false);
    }

    // ------------------------------------------------------
    // Deferred: dataset statistics (heavy CSV aggregation,
    // cached backend-side after first computation).
    // ------------------------------------------------------

    setStatsLoading(true);

    try {
      const statsData = await getDatasetStatistics();
      setStatistics(statsData);
    } catch (err) {
      setStatsError(
        err instanceof Error
          ? err.message
          : "Failed to load dataset statistics."
      );
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ==========================================================
     RUN PIPELINE ACTION
  ========================================================== */

  const handleAction = async (
    action: string
  ) => {
    const datasetId =
      overview?.activeDatasetId || overview?.datasetId;

    if (!datasetId) {
      setError(
        "Dataset ID is not available. Please refresh the page."
      );
      return;
    }

    setRunningAction(action);
    setError(null);

    try {
      switch (action) {
        case "cleaning":
          await runCleaning(datasetId);
          break;

        case "featureEngineering":
          await runFeatureEngineering(datasetId);
          break;

        case "preprocessing":
          await runPreprocessing(datasetId);
          break;

        case "smote":
          await runBalanceDataset(datasetId);
          break;

        default:
          throw new Error(
            `Unknown dataset action: ${action}`
          );
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to run ${action}.`
      );
    } finally {
      setRunningAction(null);
    }
  };

  /* ==========================================================
     STAGE HELPERS
  ========================================================== */

  const getStage = (
    key: string
  ): PipelineStage | undefined => {
    return pipelineStages.find(
      (stage) => stage.key === key
    );
  };

  const isStageCompleted = (
    key: string
  ): boolean => {
    return getStage(key)?.status === "completed";
  };

  const isStageRunning = (
    key: string
  ): boolean => {
    return getStage(key)?.status === "running";
  };

  const completedStages =
    pipelineStages.filter(
      (stage) => stage.status === "completed"
    ).length;

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Dataset",
          description:
            "Manage and inspect datasets used for fraud detection.",
          breadcrumb: "DATA / Dataset",
          systemStatus: "online",
        }}
      >
        <div className="space-y-6">
          <LoadingSkeleton className="h-8 w-64 rounded-lg" />

          <LoadingSkeleton className="h-40 rounded-2xl" />

          <div className="space-y-3">
            {PIPELINE_STAGES_ORDER.map(
              (stage) => (
                <LoadingSkeleton
                  key={stage.key}
                  className="h-16 rounded-xl"
                />
              )
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <LoadingSkeleton className="h-64 rounded-2xl" />
            <LoadingSkeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  /* ==========================================================
     ERROR
  ========================================================== */

  if (error && !overview) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Dataset",
          description:
            "Manage and inspect datasets used for fraud detection.",
          breadcrumb: "DATA / Dataset",
          systemStatus: "error",
        }}
      >
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
          <div className="flex items-start gap-3">
            <XCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-400"
            />

            <div>
              <p className="font-semibold text-red-300">
                Failed to load dataset
              </p>

              <p className="mt-1 text-sm text-red-300/80">
                {error}
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </AppShell>
    );
  }

  if (!overview) {
    return null;
  }

  /* ==========================================================
     STATUS COLORS
  ========================================================== */

  const statusColors: Record<
    string,
    string
  > = {
    uploaded:
      "text-warning bg-warning/10 border-warning/25",

    processed:
      "text-primary bg-primary/10 border-primary/25",

    ready:
      "text-success bg-success/10 border-success/25",

    error:
      "text-danger bg-danger/10 border-danger/25",
  };

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Dataset",
        description:
          "Manage and inspect datasets used for fraud detection.",
        breadcrumb: "DATA / Dataset",
        systemStatus: "online",
      }}
    >
      <motion.div
        initial={{
          opacity: 0,
          y: 8,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.4,
        }}
        className="space-y-6"
      >
        {/* ==================================================
            DATASET OVERVIEW
        ================================================== */}

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            {/* Dataset information */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Database
                  size={16}
                  className="text-primary"
                />

                <p className="text-sm font-medium text-primary">
                  IEEE-CIS Fraud Detection
                </p>
              </div>

              <h1 className="mt-1 text-2xl font-bold text-slate-50">
                {overview.name}
              </h1>

              <p className="mt-2 max-w-2xl text-xs text-slate-500">
                Benchmark transaction and identity
                dataset used by Phoenix for fraud
                detection model development.
              </p>

              {/* Dataset ID */}
              <div className="mt-3">
                <span className="mr-2 text-[10px] uppercase tracking-wider text-faint">
                  Dataset ID
                </span>

                <span className="font-mono text-[10px] text-slate-400">
                  {overview.datasetId ||
                    "Not available"}
                </span>
              </div>
            </div>

            {/* Status + actions */}
            <div className="flex flex-col gap-3 xl:items-end">
              <span
                className={`w-fit rounded-full border px-3 py-1 text-sm font-medium ${
                  statusColors[
                    overview.status
                  ] ??
                  "border-slate-600 bg-slate-600/10 text-slate-400"
                }`}
              >
                {overview.status
                  .charAt(0)
                  .toUpperCase() +
                  overview.status.slice(1)}
              </span>

              {/* Pipeline buttons */}
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <button
                  onClick={() =>
                    handleAction("cleaning")
                  }
                  title={
                    isStageCompleted("cleaning")
                      ? "Cleaning already completed — artifacts exist"
                      : "Run cleaning manually"
                  }
                  disabled={
                    runningAction !== null ||
                    isStageRunning("cleaning") ||
                    !isStageCompleted("raw") ||
                    isStageCompleted("cleaning")
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-card-border bg-bg/60 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {runningAction ===
                  "cleaning" ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  ) : (
                    <Sparkles size={13} />
                  )}

                  Clean
                </button>

                <button
                  onClick={() =>
                    handleAction(
                      "featureEngineering"
                    )
                  }
                  title={
                    isStageCompleted(
                      "featureEngineering"
                    )
                      ? "Feature engineering already completed — artifacts exist"
                      : "Run feature engineering manually"
                  }
                  disabled={
                    runningAction !== null ||
                    isStageRunning(
                      "featureEngineering"
                    ) ||
                    !isStageCompleted(
                      "cleaning"
                    ) ||
                    isStageCompleted(
                      "featureEngineering"
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-card-border bg-bg/60 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {runningAction ===
                  "featureEngineering" ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  ) : (
                    <Layers size={13} />
                  )}

                  Features
                </button>

                <button
                  onClick={() =>
                    handleAction(
                      "preprocessing"
                    )
                  }
                  title={
                    isStageCompleted(
                      "preprocessing"
                    )
                      ? "Preprocessing already completed — artifacts exist"
                      : "Run preprocessing manually"
                  }
                  disabled={
                    runningAction !== null ||
                    isStageRunning(
                      "preprocessing"
                    ) ||
                    !isStageCompleted(
                      "featureEngineering"
                    ) ||
                    isStageCompleted(
                      "preprocessing"
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-card-border bg-bg/60 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {runningAction ===
                  "preprocessing" ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  ) : (
                    <SlidersHorizontal
                      size={13}
                    />
                  )}

                  Preprocess
                </button>

                <button
                  onClick={() =>
                    handleAction("smote")
                  }
                  title={
                    isStageCompleted("smote")
                      ? "SMOTE balancing already completed — artifacts exist"
                      : "Run SMOTE balancing manually"
                  }
                  disabled={
                    runningAction !== null ||
                    isStageRunning("smote") ||
                    !isStageCompleted(
                      "preprocessing"
                    ) ||
                    isStageCompleted("smote")
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-card-border bg-bg/60 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {runningAction === "smote" ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  ) : (
                    <GitMerge size={13} />
                  )}

                  Balance
                </button>

              </div>
            </div>
          </div>

          {/* ==================================================
              STATS
          ================================================== */}

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
            <StatTile
              icon={BarChart3}
              label="Rows"
              value={formatNumber(
                overview.rows
              )}
              iconColor="#3b82f6"
            />

            <StatTile
              icon={Layers}
              label="Columns"
              value={formatNumber(
                overview.columns
              )}
              iconColor="#6366f1"
            />

            <StatTile
              icon={ShieldAlert}
              label="Fraud Txns"
              value={formatNumber(
                overview.fraudTransactions
              )}
              iconColor="#ef4444"
            />

            <StatTile
              icon={ShieldCheck}
              label="Legitimate Txns"
              value={formatNumber(
                overview.legitimateTransactions
              )}
              iconColor="#22c55e"
            />

            <StatTile
              icon={TrendingUp}
              label="Fraud Rate"
              value={formatPercentage(
                overview.fraudRate
              )}
              iconColor="#f97316"
            />

            <StatTile
              icon={User}
              label="Identity Records"
              value={formatNumber(
                overview.identityRecords
              )}
              iconColor="#2563eb"
            />

            <StatTile
              icon={Clock}
              label="Last Processed"
              value={formatDate(
                overview.lastProcessed
              )}
              iconColor="#64748b"
            />
          </div>
        </div>

        {/* ==================================================
            TRAINED MODEL (READ-ONLY)
        ================================================== */}

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Rocket
                  size={16}
                  className="text-primary"
                />

                <p className="text-sm font-medium text-primary">
                  Trained XGBoost Model
                </p>
              </div>

              <h2 className="mt-1 text-xl font-bold text-slate-50">
                {model?.model_name ??
                  "Model information unavailable"}
              </h2>

              <p className="mt-2 max-w-2xl text-xs text-slate-500">
                Existing IEEE-CIS fraud detection
                model from the saved backend
                artifacts. This page never trains
                or replaces it.
              </p>

              <div className="mt-3">
                <span className="mr-2 text-[10px] uppercase tracking-wider text-faint">
                  Dataset ID
                </span>

                <span className="font-mono text-[10px] text-slate-400">
                  f99a1cac-51a4-4d18-9b82-a06d975dd97b
                </span>
              </div>
            </div>

            <span className="w-fit rounded-full border border-success/25 bg-success/10 px-3 py-1 text-sm font-medium text-success">
              {model?.status ?? "Trained"}
            </span>
          </div>

          {modelError && !model && (
            <p className="mt-4 text-xs text-red-300">
              {modelError}
            </p>
          )}

          {model && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-6">
              <StatTile
                icon={TrendingUp}
                label="ROC-AUC"
                value={formatPercentage(
                  model.roc_auc
                )}
                iconColor="#f97316"
              />

              <StatTile
                icon={ShieldCheck}
                label="Precision"
                value={formatPercentage(
                  model.precision
                )}
                iconColor="#22c55e"
              />

              <StatTile
                icon={ShieldAlert}
                label="Recall"
                value={formatPercentage(
                  model.recall
                )}
                iconColor="#ef4444"
              />

              <StatTile
                icon={BarChart3}
                label="F1 Score"
                value={formatPercentage(
                  model.f1_score
                )}
                iconColor="#3b82f6"
              />

              <StatTile
                icon={Database}
                label="Train Rows"
                value={formatNumber(
                  model.train_rows
                )}
                iconColor="#6366f1"
              />

              <StatTile
                icon={Clock}
                label="Trained"
                value={formatDate(
                  model.created_at
                )}
                iconColor="#64748b"
              />
            </div>
          )}
        </div>

        {/* ==================================================
            ERROR BANNER
        ================================================== */}

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <XCircle
                size={18}
                className="shrink-0 text-red-400"
              />

              <p className="text-sm text-red-300">
                {error}
              </p>
            </div>

            <button
              onClick={loadData}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        )}

        {/* ==================================================
            PIPELINE VISUALIZATION
        ================================================== */}

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Processing Pipeline
              </h2>

                <p className="mt-1 text-[11px] text-slate-500">
                  IEEE-CIS dataset preparation
                  workflow. Stages are manual only;
                  the trained model is read-only.
                </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400">
                {completedStages} /{" "}
                {PIPELINE_STAGES_ORDER.length}{" "}
                completed
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {PIPELINE_STAGES_ORDER.map(
              (stageConfig, index) => {
                const backendStage =
                  getStage(stageConfig.key);

                const stage: PipelineStage =
                  backendStage ?? {
                    key: stageConfig.key,
                    label: stageConfig.label,
                    status: "pending",
                    details:
                      "Waiting for previous stage.",
                  };

                return (
                  <div
                    key={stageConfig.key}
                    className="flex flex-col"
                  >
                    <StageCard
                      stage={stage}
                      stageIcon={
                        stageConfig.icon
                      }
                      isRunning={
                        runningAction ===
                        stageConfig.key
                      }
                    />

                    <PipelineArrow
                      isLast={
                        index ===
                        PIPELINE_STAGES_ORDER.length -
                          1
                      }
                    />
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* ==================================================
            DATASET STATISTICS (DEFERRED)
        ================================================== */}

        {statsLoading && !statistics && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <LoadingSkeleton className="h-64 rounded-2xl" />
            <LoadingSkeleton className="h-64 rounded-2xl" />
          </div>
        )}

        {statsError && !statistics && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-300">
              {statsError}
            </p>

            <button
              onClick={loadData}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
            >
              <RefreshCw size={13} />
              Retry stats
            </button>
          </div>
        )}

        {statistics && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* ==================================================
                FRAUD VS LEGITIMATE
            ================================================== */}

            <div className="rounded-2xl border border-card-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Fraud vs Legitimate
                  </h2>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Original IEEE-CIS class distribution.
                  </p>
                </div>

                <ShieldAlert
                  size={17}
                  className="text-primary"
                />
              </div>

              <div className="mt-4 h-56">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <PieChart>
                    <Pie
                      data={
                        statistics.fraudVsLegitimate
                      }
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={78}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {statistics.fraudVsLegitimate.map(
                        (entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name ===
                              "Fraud"
                                ? "#ef4444"
                                : "#22c55e"
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip
                      contentStyle={{
                        background:
                          "#1e293b",
                        border:
                          "1px solid #27344a",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "#e2e8f0",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 space-y-2">
                {statistics.fraudVsLegitimate.map(
                  (item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              item.name ===
                              "Fraud"
                                ? "#ef4444"
                                : "#22c55e",
                          }}
                        />

                        <span className="text-slate-300">
                          {item.name}
                        </span>
                      </div>

                      <span className="font-medium text-slate-200">
                        {formatNumber(
                          item.value
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* ==================================================
                MISSING VALUES
            ================================================== */}

            <div className="rounded-2xl border border-card-border bg-card p-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Missing Values
                </h2>

                <p className="mt-1 text-[11px] text-slate-500">
                  Top 10 features with missing values.
                </p>
              </div>

              <div className="mt-4 h-56">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={statistics.missingValues.slice(
                      0,
                      10
                    )}
                    layout="vertical"
                    margin={{
                      top: 5,
                      right: 20,
                      left: 100,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      stroke="#27344A"
                      strokeDasharray="3 3"
                      horizontal={false}
                    />

                    <XAxis
                      type="number"
                      tick={{
                        fill: "#64748B",
                        fontSize: 10,
                      }}
                      axisLine={{
                        stroke: "#27344A",
                      }}
                      tickLine={false}
                    />

                    <YAxis
                      type="category"
                      dataKey="feature"
                      width={90}
                      tick={{
                        fill: "#94A3B8",
                        fontSize: 10,
                      }}
                      axisLine={{
                        stroke: "#27344A",
                      }}
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        background:
                          "#1e293b",
                        border:
                          "1px solid #27344a",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />

                    <Bar
                      dataKey="missing"
                      radius={[
                        0,
                        4,
                        4,
                        0,
                      ]}
                      fill="#f97316"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ==================================================
                FEATURE DISTRIBUTION
            ================================================== */}

            <div className="rounded-2xl border border-card-border bg-card p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Feature Distribution
                  </h2>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Statistical summary of selected numerical
                    features.
                  </p>
                </div>

                <BarChart3
                  size={17}
                  className="text-primary"
                />
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                      <th className="px-3 py-2.5 font-medium">
                        Feature
                      </th>

                      <th className="px-3 py-2.5 font-medium">
                        Mean
                      </th>

                      <th className="px-3 py-2.5 font-medium">
                        Std Dev
                      </th>

                      <th className="px-3 py-2.5 font-medium">
                        Min
                      </th>

                      <th className="px-3 py-2.5 font-medium">
                        Max
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {statistics.featureDistribution
                      .slice(0, 15)
                      .map((feature) => (
                        <tr
                          key={feature.feature}
                          className="border-b border-card-border/40 last:border-0 hover:bg-bg/30"
                        >
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                            {feature.feature}
                          </td>

                          <td className="px-3 py-2.5 text-slate-300">
                            {feature.mean.toFixed(
                              4
                            )}
                          </td>

                          <td className="px-3 py-2.5 text-slate-300">
                            {feature.std.toFixed(
                              4
                            )}
                          </td>

                          <td className="px-3 py-2.5 text-slate-300">
                            {feature.min.toFixed(
                              4
                            )}
                          </td>

                          <td className="px-3 py-2.5 text-slate-300">
                            {feature.max.toFixed(
                              4
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ==================================================
                IDENTITY COVERAGE
            ================================================== */}

            <div className="rounded-2xl border border-card-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Identity Coverage
                  </h2>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Availability of identity information in the
                    transaction dataset.
                  </p>
                </div>

                <User
                  size={17}
                  className="text-primary"
                />
              </div>

              <div className="mt-5 space-y-4">
                {statistics.identityCoverage.map(
                  (field) => (
                    <div
                      key={field.field}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-slate-300">
                          {field.field}
                        </span>

                        <span className="font-mono text-xs text-slate-400">
                          {(
                            field.coverage *
                            100
                          ).toFixed(2)}
                          %
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-bg">
                        <motion.div
                          initial={{
                            width: 0,
                          }}
                          animate={{
                            width: `${Math.min(
                              field.coverage *
                                100,
                              100
                            )}%`,
                          }}
                          transition={{
                            duration: 0.8,
                          }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            FOOTER DATASET INFORMATION
        ================================================== */}

        <div className="rounded-xl border border-card-border/70 bg-bg/30 px-4 py-3">
          <div className="flex flex-col gap-2 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Phoenix Dataset Engine · IEEE-CIS Fraud
              Detection
            </span>

            <span className="font-mono">
              {overview.datasetId ||
                "Dataset ID unavailable"}
            </span>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}

export default Dataset;