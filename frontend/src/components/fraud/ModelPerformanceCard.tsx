import { motion } from "framer-motion";
import {
  Gauge,
  Target,
  Crosshair,
  Scale,
  LineChart as LineChartIcon,
  Loader2,
  AlertTriangle,
  RefreshCcw,
  Grid3x3,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { StatTile } from "../dataset/StatTile";
import { safeNumber, safeString } from "../../utils/format";
import type { LatestDatasetStatus } from "../../types/fraud";

interface ModelPerformanceCardProps {
  status: LatestDatasetStatus | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function pct(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";
}

const CHART_ORANGE = "#f97316";
const CHART_ORANGE_DIM = "#f9731655";
const CHART_GRID = "#27344a";
const CHART_TEXT = "#94a3b8";

export function ModelPerformanceCard({ status, loading, error, onRetry }: ModelPerformanceCardProps) {
  const model = status?.model ?? null;

  const rocData =
    model?.roc_curve?.fpr.map((fpr, i) => ({
      fpr,
      tpr: model.roc_curve!.tpr[i],
      // reference diagonal for a random classifier
      baseline: fpr,
    })) ?? [];

  const featureData =
    model?.feature_importance
      ?.slice(0, 10)
      .map((f) => ({ feature: f.feature, importance: f.importance })) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-card-border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Model Performance</h2>
          <p className="mt-0.5 text-xs text-faint">
            Metrics from the most recently trained fraud detection model.
          </p>
        </div>

        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Refresh
        </button>
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-xs text-faint">
          <Loader2 size={14} className="animate-spin" /> Loading model status…
        </div>
      )}

      {!loading && error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-medium text-danger">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {!loading && !error && status && !model && (
        <p className="mt-6 text-xs text-faint">
          No trained model yet for dataset "{safeString(status.dataset.dataset_name)}". Train one from the Dataset
          Management page to see performance metrics here.
        </p>
      )}

      {!loading && !error && model && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile icon={Gauge} label="Accuracy" value={pct(model.accuracy)} />
            <StatTile icon={Target} label="Precision" value={pct(model.precision)} />
            <StatTile icon={Crosshair} label="Recall" value={pct(model.recall)} />
            <StatTile icon={Scale} label="F1 Score" value={pct(model.f1_score)} />
            <StatTile icon={LineChartIcon} label="ROC AUC" value={pct(model.roc_auc)} />
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-faint">
            <span>Train rows: {safeNumber(model.train_rows)}</span>
            <span>Test rows: {safeNumber(model.test_rows)}</span>
            <span>Model: {safeString(model.model_name)}</span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Confusion Matrix */}
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-4">
              <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-faint">
                <Grid3x3 size={13} />
                Confusion Matrix
              </div>
              {model.confusion_matrix ? (
                <ConfusionMatrixGrid data={model.confusion_matrix} />
              ) : (
                <EmptyChart label="No confusion matrix data yet" />
              )}
            </div>

            {/* ROC Curve */}
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-4">
              <div className="mb-3 flex items-center justify-between text-[11px] font-medium text-faint">
                <span className="flex items-center gap-1.5">
                  <LineChartIcon size={13} />
                  ROC Curve
                </span>
                {model.roc_curve && <span className="text-primary">AUC {model.roc_curve.auc.toFixed(3)}</span>}
              </div>
              {rocData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={rocData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="fpr"
                      type="number"
                      domain={[0, 1]}
                      tick={{ fill: CHART_TEXT, fontSize: 10 }}
                      stroke={CHART_GRID}
                      label={{ value: "FPR", position: "insideBottom", offset: -2, fill: CHART_TEXT, fontSize: 10 }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fill: CHART_TEXT, fontSize: 10 }}
                      stroke={CHART_GRID}
                      label={{ value: "TPR", angle: -90, position: "insideLeft", fill: CHART_TEXT, fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #27344a", fontSize: 11 }}
                      labelFormatter={(v) => `FPR ${Number(v).toFixed(3)}`}
                      formatter={(v, name) => [Number(v).toFixed(3), name === "tpr" ? "TPR" : "Random"]}
                    />
                    <Line type="monotone" dataKey="baseline" stroke="#475569" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="tpr" stroke={CHART_ORANGE} dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No ROC data yet" />
              )}
            </div>

            {/* Feature Importance */}
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-4">
              <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-faint">
                <Scale size={13} />
                Feature Importance
              </div>
              {featureData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={featureData}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: CHART_TEXT, fontSize: 10 }} stroke={CHART_GRID} />
                    <YAxis
                      type="category"
                      dataKey="feature"
                      width={110}
                      tick={{ fill: CHART_TEXT, fontSize: 9 }}
                      stroke={CHART_GRID}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #27344a", fontSize: 11 }}
                      formatter={(v) => [Number(v).toFixed(4), "Importance"]}
                    />
                    <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                      {featureData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? CHART_ORANGE : CHART_ORANGE_DIM} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No feature importance data yet" />
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center text-center text-[11px] text-faint">{label}</div>
  );
}

function ConfusionMatrixGrid({
  data,
}: {
  data: { true_negative: number; false_positive: number; false_negative: number; true_positive: number };
}) {
  const { true_negative, false_positive, false_negative, true_positive } = data;
  const max = Math.max(true_negative, false_positive, false_negative, true_positive, 1);

  const cell = (value: number, tone: "success" | "danger", label: string) => {
    const intensity = 0.15 + 0.55 * (value / max);
    const bg = tone === "success" ? `rgba(34,197,94,${intensity})` : `rgba(239,68,68,${intensity})`;
    const border = tone === "success" ? "border-success/25" : "border-danger/25";
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border ${border} py-3`}
        style={{ backgroundColor: bg }}
        title={`${label}: ${value}`}
      >
        <span className="text-lg font-bold text-slate-50">{value}</span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-200/80">{label}</span>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-1 grid grid-cols-[3rem_1fr_1fr] items-center gap-1.5 text-center text-[9px] text-faint">
        <span />
        <span>Pred. Legit</span>
        <span>Pred. Fraud</span>
      </div>
      <div className="grid grid-cols-[3rem_1fr_1fr] items-center gap-1.5">
        <span className="text-[9px] text-faint">Actual Legit</span>
        {cell(true_negative, "success", "TN")}
        {cell(false_positive, "danger", "FP")}
        <span className="text-[9px] text-faint">Actual Fraud</span>
        {cell(false_negative, "danger", "FN")}
        {cell(true_positive, "success", "TP")}
      </div>
    </div>
  );
}
