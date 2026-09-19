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
import {
  ActivityTimeline,
  type ActivityEntry,
} from "../components/dataset/ActivityTimeline";
import { FooterSummary } from "../components/dataset/FooterSummary";
import { ReportsSummary } from "../components/dataset/ReportsSummary";
import { DatasetHistory } from "../components/dataset/DatasetHistory";

import {
  PipelineProgress,
  type Stage,
  type StageStatus,
} from "../components/dataset/PipelineProgress";

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
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Dataset({
  onLogout,
}: DatasetProps) {

  /**
   * ==========================================================
   * UPLOAD STATE
   * ==========================================================
   */

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(null);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState(0);

  const [
    dataset,
    setDataset,
  ] = useState<DatasetInfo | null>(null);

  const [
    validation,
    setValidation,
  ] = useState<ValidationReport | null>(null);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    success,
    setSuccess,
  ] = useState(false);


  /**
   * ==========================================================
   * PIPELINE STATE
   * ==========================================================
   */

  const [
    cleaning,
    setCleaning,
  ] = useState(false);

  const [
    cleaningReport,
    setCleaningReport,
  ] = useState<CleaningReport | null>(null);


  const [
    preprocessing,
    setPreprocessing,
  ] = useState(false);

  const [
    preprocessingReport,
    setPreprocessingReport,
  ] =
    useState<PreprocessingReport | null>(null);


  const [
    smoteLoading,
    setSmoteLoading,
  ] = useState(false);

  const [
    smoteReport,
    setSmoteReport,
  ] =
    useState<SmoteReport | null>(null);


  const [
    featureLoading,
    setFeatureLoading,
  ] = useState(false);

  const [
    featureReport,
    setFeatureReport,
  ] =
    useState<FeatureEngineeringReport | null>(
      null
    );


  const [
    splitLoading,
    setSplitLoading,
  ] = useState(false);

  const [
    splitReport,
    setSplitReport,
  ] =
    useState<TrainTestSplitReport | null>(
      null
    );


  /**
   * ==========================================================
   * COMPLETE PIPELINE LOADING
   * ==========================================================
   */

  const [
    pipelineRunning,
    setPipelineRunning,
  ] = useState(false);


  /**
   * ==========================================================
   * ACTIVITY LOG
   * ==========================================================
   */

  const [
    activity,
    setActivity,
  ] = useState<ActivityEntry[]>([]);

  const logActivity = useCallback(
    (label: string) => {

      setActivity((prev) => [
        ...prev,
        {
          time: timeNow(),
          label,
        },
      ]);

    },
    []
  );


  /**
   * ==========================================================
   * DATASET HISTORY
   * ==========================================================
   */

  const [
    historyItems,
    setHistoryItems,
  ] =
    useState<DatasetHistoryItem[]>([]);

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(false);

  const [
    historyError,
    setHistoryError,
  ] =
    useState<string | null>(null);


  const refreshHistory =
    useCallback(async () => {

      setHistoryLoading(true);
      setHistoryError(null);

      try {

        const items =
          await getDatasetHistory();

        setHistoryItems(items);

      } catch (err) {

        setHistoryError(
          err instanceof Error
            ? err.message
            : "Failed to load dataset history."
        );

      } finally {

        setHistoryLoading(false);

      }

    }, []);


  useEffect(() => {

    refreshHistory();

  }, [refreshHistory]);


  /**
   * ==========================================================
   * RESET PIPELINE REPORTS
   * ==========================================================
   */

  const resetPipelineReports = () => {

    setCleaningReport(null);

    setPreprocessingReport(null);

    setSmoteReport(null);

    setFeatureReport(null);

    setSplitReport(null);
  };


  /**
   * ==========================================================
   * FILE SELECT
   * ==========================================================
   */

  const handleFileSelect = (
    file: File
  ) => {

    setSelectedFile(file);

    setError(null);

    setSuccess(false);

    resetPipelineReports();

  };


  /**
   * ==========================================================
   * UPLOAD + AUTOMATIC PIPELINE
   * ==========================================================
   */

  const handleUpload = async () => {

    if (
      !selectedFile ||
      uploading ||
      pipelineRunning
    ) {
      return;
    }

    /**
     * ----------------------------------------
     * Start upload
     * ----------------------------------------
     */

    setUploading(true);

    setPipelineRunning(false);

    setUploadProgress(0);

    setError(null);

    setSuccess(false);

    resetPipelineReports();

    try {

      /**
       * ----------------------------------------
       * STEP 1 — UPLOAD
       * ----------------------------------------
       */

      const response =
        await uploadDataset(
          selectedFile,
          setUploadProgress
        );

      const uploadedDataset =
        response.dataset;

      setDataset(
        uploadedDataset
      );

      setValidation(
        uploadedDataset.validation ??
          null
      );

      setSuccess(true);

      logActivity(
        `Uploaded dataset "${uploadedDataset.datasetName ?? uploadedDataset.originalFilename ?? "Dataset"}"`
      );


      /**
       * ----------------------------------------
       * VALIDATION
       * ----------------------------------------
       */

      const statusUpper =
        safeUpper(
          uploadedDataset
            .validation
            ?.validationStatus
        );

      logActivity(
        statusUpper.length === 0
          ? "Validation completed"
          : statusUpper === "PASSED"
          ? "Validation completed — PASSED"
          : "Validation completed — FAILED"
      );


      /**
       * ----------------------------------------
       * Refresh history
       * ----------------------------------------
       */

      refreshHistory();


      /**
       * ----------------------------------------
       * Upload finished
       * Start pipeline
       * ----------------------------------------
       */

      setUploading(false);

      setPipelineRunning(true);


      /**
       * ======================================================
       * STEP 2 — CLEANING
       * ======================================================
       */

      setCleaning(true);

      logActivity(
        "Cleaning started"
      );

      try {

        const response =
          await cleanDataset(
            uploadedDataset.id
          );

        setCleaningReport(
          response.cleaning
        );

        logActivity(
          "Cleaning completed"
        );

      } finally {

        setCleaning(false);

      }


      /**
       * ======================================================
       * STEP 3 — PREPROCESSING
       * ======================================================
       */

      setPreprocessing(true);

      logActivity(
        "Preprocessing started"
      );

      try {

        const response =
          await preprocessDataset(
            uploadedDataset.id
          );

        setPreprocessingReport(
          response.preprocessing
        );

        logActivity(
          "Preprocessing completed"
        );

      } finally {

        setPreprocessing(false);

      }


      /**
       * ======================================================
       * STEP 4 — SMOTE
       * ======================================================
       */

      setSmoteLoading(true);

      logActivity(
        "SMOTE started"
      );

      try {

        const response =
          await applySmote(
            uploadedDataset.id
          );

        setSmoteReport(
          response.smote
        );

        logActivity(
          "SMOTE applied"
        );

      } finally {

        setSmoteLoading(false);

      }


      /**
       * ======================================================
       * STEP 5 — FEATURE ENGINEERING
       * ======================================================
       */

      setFeatureLoading(true);

      logActivity(
        "Feature engineering started"
      );

      try {

        const response =
          await generateFeatures(
            uploadedDataset.id
          );

        setFeatureReport(
          response.feature_engineering
        );

        logActivity(
          "Feature engineering completed"
        );

      } finally {

        setFeatureLoading(false);

      }


      /**
       * ======================================================
       * STEP 6 — TRAIN / TEST SPLIT
       * ======================================================
       */

      setSplitLoading(true);

      logActivity(
        "Train/Test split started"
      );

      try {

        const response =
          await splitTrainTest(
            uploadedDataset.id
          );

        setSplitReport(
          response.training
        );

        logActivity(
          "Training dataset created"
        );

        logActivity(
          "Train/Test split completed"
        );

      } finally {

        setSplitLoading(false);

      }


      /**
       * ======================================================
       * PIPELINE COMPLETED
       * ======================================================
       */

      logActivity(
        "Complete dataset pipeline finished"
      );

      setSuccess(true);

      refreshHistory();

    } catch (err) {

      /**
       * If ANY pipeline stage fails,
       * stop the pipeline and show the error.
       */

      setError(
        err instanceof Error
          ? err.message
          : "Dataset pipeline failed."
      );

      logActivity(
        "Dataset pipeline failed"
      );

    } finally {

      setUploading(false);

      setPipelineRunning(false);

      setSelectedFile(null);

    }
  };


  /**
   * ==========================================================
   * MANUAL HANDLERS
   *
   * These are kept so your existing cards continue
   * working correctly.
   *
   * But after upload, the automatic pipeline above
   * already performs them.
   * ==========================================================
   */

  const handleClean = async () => {

    if (
      !dataset ||
      cleaning ||
      pipelineRunning
    ) {
      return;
    }

    setCleaning(true);

    setError(null);

    try {

      const response =
        await cleanDataset(
          dataset.id
        );

      setCleaningReport(
        response.cleaning
      );

      logActivity(
        "Cleaning completed"
      );

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Cleaning failed."
      );

    } finally {

      setCleaning(false);

    }
  };


  const handlePreprocess =
    async () => {

      if (
        !dataset ||
        preprocessing ||
        pipelineRunning
      ) {
        return;
      }

      setPreprocessing(true);

      setError(null);

      try {

        const response =
          await preprocessDataset(
            dataset.id
          );

        setPreprocessingReport(
          response.preprocessing
        );

        logActivity(
          "Preprocessing completed"
        );

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : "Preprocessing failed."
        );

      } finally {

        setPreprocessing(false);

      }
    };


  const handleSmote = async () => {

    if (
      !dataset ||
      smoteLoading ||
      pipelineRunning
    ) {
      return;
    }

    setSmoteLoading(true);

    setError(null);

    try {

      const response =
        await applySmote(
          dataset.id
        );

      setSmoteReport(
        response.smote
      );

      logActivity(
        "SMOTE applied"
      );

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "SMOTE failed."
      );

    } finally {

      setSmoteLoading(false);

    }
  };


  const handleFeatures =
    async () => {

      if (
        !dataset ||
        featureLoading ||
        pipelineRunning
      ) {
        return;
      }

      setFeatureLoading(true);

      setError(null);

      try {

        const response =
          await generateFeatures(
            dataset.id
          );

        setFeatureReport(
          response.feature_engineering
        );

        logActivity(
          "Feature engineering completed"
        );

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : "Feature engineering failed."
        );

      } finally {

        setFeatureLoading(false);

      }
    };


  const handleSplit =
    async () => {

      if (
        !dataset ||
        splitLoading ||
        pipelineRunning
      ) {
        return;
      }

      setSplitLoading(true);

      setError(null);

      try {

        const response =
          await splitTrainTest(
            dataset.id
          );

        setSplitReport(
          response.training
        );

        logActivity(
          "Training dataset created"
        );

        logActivity(
          "Train/Test split completed"
        );

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : "Train/Test split failed."
        );

      } finally {

        setSplitLoading(false);

      }
    };


  /**
   * ==========================================================
   * SELECT DATASET FROM HISTORY
   * ==========================================================
   */

  const [
    historySelecting,
    setHistorySelecting,
  ] = useState(false);


  const handleSelectHistory =
    async (id: string) => {

      if (
        historySelecting ||
        uploading ||
        pipelineRunning
      ) {
        return;
      }

      setHistorySelecting(true);

      setError(null);

      try {

        const loaded =
          await getDatasetById(id);

        setDataset(
          loaded
        );

        setValidation(
          loaded.validation ??
            null
        );

        setSuccess(true);

        resetPipelineReports();

        logActivity(
          `Loaded dataset "${loaded.datasetName ?? loaded.originalFilename ?? loaded.id}" from history`
        );

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dataset."
        );

      } finally {

        setHistorySelecting(false);

      }
    };


  /**
   * ==========================================================
   * PIPELINE STAGE STATUS
   * ==========================================================
   */

  const statusFor = (
    loading: boolean,
    done: boolean
  ): StageStatus => {

    if (loading) {
      return "running";
    }

    if (done) {
      return "completed";
    }

    return "pending";
  };


  const stages: Stage[] = [

    {
      key: "upload",
      label: "Dataset Upload",
      icon: UploadCloud,
      status: statusFor(
        uploading,
        !!dataset
      ),
    },

    {
      key: "validation",
      label: "Validation",
      icon: ShieldCheck,
      status: statusFor(
        uploading,
        !!validation
      ),
    },

    {
      key: "cleaning",
      label: "Cleaning",
      icon: Sparkles,
      status: statusFor(
        cleaning,
        !!cleaningReport
      ),
    },

    {
      key: "preprocessing",
      label: "Preprocessing",
      icon: SlidersHorizontal,
      status: statusFor(
        preprocessing,
        !!preprocessingReport
      ),
    },

    {
      key: "smote",
      label: "SMOTE",
      icon: GitMerge,
      status: statusFor(
        smoteLoading,
        !!smoteReport
      ),
    },

    {
      key: "features",
      label: "Feature Engineering",
      icon: Layers,
      status: statusFor(
        featureLoading,
        !!featureReport
      ),
    },

    {
      key: "split",
      label: "Train/Test Split",
      icon: SplitSquareHorizontal,
      status: statusFor(
        splitLoading,
        !!splitReport
      ),
    },

    {
      key: "ready",
      label: "Ready for Training",
      icon: Rocket,
      status:
        splitReport
          ? "completed"
          : "pending",
    },
  ];


  /**
   * ==========================================================
   * COMPLETION %
   * ==========================================================
   */

  const completedActionStages = [
    dataset,
    cleaningReport,
    preprocessingReport,
    smoteReport,
    featureReport,
    splitReport,
  ].filter(Boolean).length;


  const completionPct =
    Math.round(
      (completedActionStages / 6) *
        100
    );


  /**
   * ==========================================================
   * STORAGE FLOW
   * ==========================================================
   */

  const storageActiveIndex =
    splitReport
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


  /**
   * ==========================================================
   * CURRENT STAGE
   * ==========================================================
   */

  const currentStageLabel =
    pipelineRunning
      ? stages.find(
          (stage) =>
            stage.status ===
            "running"
        )?.label ??
        "Processing"
      : stages.find(
          (stage) =>
            stage.status !==
            "completed"
        )?.label ??
        "Ready for Training";


  /**
   * ==========================================================
   * LAST UPDATED
   * ==========================================================
   */

  const lastUpdated =
    activity.length > 0
      ? activity[
          activity.length - 1
        ].time
      : "—";


  /**
   * ==========================================================
   * PROCEED
   * ==========================================================
   */

  const handleProceed = () => {

    if (
      !splitReport ||
      pipelineRunning
    ) {
      return;
    }

    logActivity(
      "Requested to proceed to Model Training"
    );

    // Add navigation logic here if required.
  };


  /**
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (

    <AppShell
      onLogout={onLogout}
    >

      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

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
        className="flex flex-wrap items-end justify-between gap-4"
      >

        <div>

          <h1 className="text-2xl font-bold text-slate-50">
            Dataset Management
          </h1>

          <p className="mt-1 text-sm text-muted">
            Upload, validate and prepare
            transaction datasets for the
            fraud detection pipeline.
          </p>

        </div>


        <div className="flex flex-wrap gap-3">

          <HeaderStat
            icon={ShieldCheck}
            label="Dataset Status"
            value={
              dataset?.status ??
              "No Dataset"
            }
          />

          <HeaderStat
            icon={ActivityIcon}
            label="Pipeline Stage"
            value={
              currentStageLabel
            }
          />

          <HeaderStat
            icon={Clock}
            label="Last Updated"
            value={
              lastUpdated
            }
          />

        </div>

      </motion.div>


      {/* ================================================== */}
      {/* UPLOAD */}
      {/* ================================================== */}

      <UploadCard

        selectedFile={
          selectedFile
        }

        onFileSelect={
          handleFileSelect
        }

        onUpload={
          handleUpload
        }

        uploading={
          uploading ||
          pipelineRunning
        }

        uploadProgress={
          uploadProgress
        }

        error={
          error
        }

        success={
          success
        }

        dataset={
          dataset
        }

      />


      {/* ================================================== */}
      {/* DATASET OVERVIEW */}
      {/* ================================================== */}

      <DatasetOverview
        dataset={
          dataset
        }
      />


      {/* ================================================== */}
      {/* VALIDATION */}
      {/* ================================================== */}

      <ValidationCard
        validation={
          validation
        }
      />


      {/* ================================================== */}
      {/* PIPELINE PROGRESS */}
      {/* ================================================== */}

      <PipelineProgress
        stages={
          stages
        }
      />


      {/* ================================================== */}
      {/* CLEANING */}
      {/* ================================================== */}

      <CleaningCard

        onRun={
          handleClean
        }

        loading={
          cleaning
        }

        report={
          cleaningReport
        }

        locked={
          !dataset ||
          pipelineRunning
        }

      />


      {/* ================================================== */}
      {/* PREPROCESSING */}
      {/* ================================================== */}

      <PreprocessingCard

        onRun={
          handlePreprocess
        }

        loading={
          preprocessing
        }

        report={
          preprocessingReport
        }

        locked={
          !cleaningReport ||
          pipelineRunning
        }

      />


      {/* ================================================== */}
      {/* SMOTE */}
      {/* ================================================== */}

      <SmoteCard

        onRun={
          handleSmote
        }

        loading={
          smoteLoading
        }

        report={
          smoteReport
        }

        locked={
          !preprocessingReport ||
          pipelineRunning
        }

      />


      {/* ================================================== */}
      {/* FEATURE ENGINEERING */}
      {/* ================================================== */}

      <FeatureEngineeringCard

        onRun={
          handleFeatures
        }

        loading={
          featureLoading
        }

        report={
          featureReport
        }

        locked={
          !smoteReport ||
          pipelineRunning
        }

      />


      {/* ================================================== */}
      {/* TRAIN / TEST SPLIT */}
      {/* ================================================== */}

      <TrainTestSplitCard

        onRun={
          handleSplit
        }

        loading={
          splitLoading
        }

        report={
          splitReport
        }

        locked={
          !featureReport ||
          pipelineRunning
        }

      />


      {/* ================================================== */}
      {/* REPORT SUMMARY */}
      {/* ================================================== */}

      <ReportsSummary

        cleaning={
          cleaningReport
        }

        preprocessing={
          preprocessingReport
        }

        smote={
          smoteReport
        }

        featureEngineering={
          featureReport
        }

        split={
          splitReport
        }

      />


      {/* ================================================== */}
      {/* STORAGE FLOW */}
      {/* ================================================== */}

      <StorageFlow
        activeIndex={
          storageActiveIndex
        }
      />


      {/* ================================================== */}
      {/* DATASET HISTORY */}
      {/* ================================================== */}

      <DatasetHistory

        items={
          historyItems
        }

        loading={
          historyLoading
        }

        error={
          historyError
        }

        onSelect={
          handleSelectHistory
        }

      />


      {/* ================================================== */}
      {/* ACTIVITY TIMELINE */}
      {/* ================================================== */}

      <ActivityTimeline
        entries={
          activity
        }
      />


      {/* ================================================== */}
      {/* FOOTER */}
      {/* ================================================== */}

      <FooterSummary

        completionPct={
          completionPct
        }

        datasetsProcessed={
          historyItems.length
        }

        ready={
          !!splitReport
        }

        onProceed={
          handleProceed
        }

      />

    </AppShell>
  );
}


/**
 * ==========================================================
 * HEADER STAT COMPONENT
 * ==========================================================
 */

function HeaderStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {

  return (

    <div className="flex items-center gap-2.5 rounded-xl border border-card-border bg-card px-3.5 py-2.5">

      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">

        <Icon size={14} />

      </div>

      <div>

        <p className="text-[10px] text-faint">
          {label}
        </p>

        <p
          className="max-w-[9rem] truncate text-xs font-semibold text-slate-100"
          title={value}
        >
          {value}
        </p>

      </div>

    </div>
  );
}


export default Dataset;