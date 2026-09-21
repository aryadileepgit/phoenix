import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Target,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  Brain,
  Clock,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
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
import { getModelPerformance } from "../services/modelPerformanceService";
import type { ModelPerformanceData } from "../types/modelPerformance";

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconColor = "#f97316",
}: {
  icon: React.ComponentType<{
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-50">{value}</p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${iconColor}1A`, color: iconColor }}
        >
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

function ModelInfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-primary" />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <span className="font-mono text-sm font-bold text-slate-100">
        {value}
      </span>
    </div>
  );
}

export function ModelPerformance({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<ModelPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getModelPerformance();
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load model performance."
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Model Performance",
          description: "Stored evaluation of the deployed model.",
          breadcrumb: "INTELLIGENCE / Model Performance",
          systemStatus: "online",
        }}
      >
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-slate-700" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton
                key={i}
                className="h-28 rounded-xl border border-slate-600/50 bg-card p-5"
              />
            ))}
          </div>
          <LoadingSkeleton className="h-80 rounded-xl border border-slate-600/50 bg-card p-5" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Model Performance",
          description: "Stored evaluation of the deployed model.",
          breadcrumb: "INTELLIGENCE / Model Performance",
          systemStatus: "error",
        }}
      >
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error || "Failed to load model performance"}
        </div>
      </AppShell>
    );
  }

  const { model_info, metrics, roc_curve, confusion_matrix } = data;

  const rocPoints =
    roc_curve !== null
      ? roc_curve.fpr.map((fpr, i) => ({
          fpr,
          tpr: roc_curve.tpr[Math.min(i, roc_curve.tpr.length - 1)] ?? 0,
        })).filter((_, i, arr) => i % Math.ceil(arr.length / 300) === 0)
      : [];

  const cm = confusion_matrix?.matrix ?? null;
  const cmLabels = confusion_matrix?.labels ?? [
    "Legitimate",
    "Fraud",
  ];
  const tn = cm?.[0]?.[0] ?? null;
  const fp = cm?.[0]?.[1] ?? null;
  const fn = cm?.[1]?.[0] ?? null;
  const tp = cm?.[1]?.[1] ?? null;

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Model Performance",
        description: "Stored evaluation of the deployed model.",
        breadcrumb: "INTELLIGENCE / Model Performance",
        systemStatus: "online",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">
              {model_info.algorithm} Fraud Detection Model
            </p>
            <h1 className="text-2xl font-bold text-slate-50">
              {model_info.model_name}
            </h1>
          </div>
          <span className="rounded-full border border-success/25 bg-success/10 px-3 py-1 text-sm font-medium text-success">
            <CheckCircle2 size={12} className="mr-1 inline" />
            {model_info.status}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={Target}
            label="Accuracy"
            value={formatPercentage(metrics.accuracy)}
            iconColor="#3b82f6"
          />
          <StatCard
            icon={Target}
            label="Precision"
            value={formatPercentage(metrics.precision)}
            iconColor="#22c55e"
          />
          <StatCard
            icon={Target}
            label="Recall"
            value={formatPercentage(metrics.recall)}
            iconColor="#f97316"
          />
          <StatCard
            icon={Target}
            label="F1 Score"
            value={formatPercentage(metrics.f1_score)}
            iconColor="#facc15"
          />
          <StatCard
            icon={TrendingUp}
            label="ROC-AUC"
            value={formatPercentage(metrics.roc_auc)}
            iconColor="#2563eb"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-600/50 bg-card p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                ROC Curve (stored)
              </h2>
              <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">
                AUC: {formatPercentage(metrics.roc_auc)}
              </span>
            </div>
            <div className="h-80">
              {rocPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={rocPoints}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#27344A" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="fpr"
                      domain={[0, 1]}
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: "False Positive Rate",
                        position: "insideBottom",
                        offset: -10,
                        fill: "#64748B",
                        fontSize: 12,
                      }}
                    />
                    <YAxis
                      dataKey="tpr"
                      domain={[0, 1]}
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: "True Positive Rate",
                        angle: -90,
                        position: "insideLeft",
                        offset: 20,
                        fill: "#64748B",
                        fontSize: 12,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid #27344a",
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      formatter={(value: any, name: any) => [
                        Number(value).toFixed(4),
                        name === "tpr" ? "TPR" : "FPR",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="tpr"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-80 items-center justify-center text-xs text-faint">
                  No stored ROC curve
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Precision-Recall
            </h2>
            <div className="flex h-80 flex-col items-center justify-center gap-2 text-center">
              <AlertCircle size={20} className="text-faint" />
              <p className="text-xs text-faint">
                Not stored by the training pipeline.
              </p>
              <p className="max-w-xs text-[11px] text-faint">
                Phoenix does not fabricate a PR curve. Only the
                stored ROC curve, confusion matrix, and feature
                importance are shown.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-600/50 bg-card p-5 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-slate-100">
              Confusion Matrix (stored)
            </h2>
            {cm !== null &&
            tn !== null &&
            fp !== null &&
            fn !== null &&
            tp !== null ? (
              <div className="mx-auto grid max-w-md grid-cols-2 gap-4">
                {[
                  { label: cmLabels[0] ?? "Negative", value: tn, color: "#22c55e", bg: "bg-success/10" },
                  { label: `False Positive`, value: fp, color: "#facc15", bg: "bg-warning/10" },
                  { label: `False Negative`, value: fn, color: "#facc15", bg: "bg-warning/10" },
                  { label: cmLabels[1] ?? "Fraud", value: tp, color: "#22c55e", bg: "bg-success/10" },
                ].map((cell) => (
                  <div
                    key={cell.label}
                    className={`rounded-xl border border-card-border p-6 text-center ${cell.bg}`}
                  >
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-faint">
                      {cell.label}
                    </p>
                    <p
                      className="text-4xl font-bold"
                      style={{ color: cell.color }}
                    >
                      {formatNumber(cell.value)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-faint">
                No stored confusion matrix
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Model Information
            </h2>
            <div className="mt-4 space-y-4">
              <ModelInfoRow
                label="Algorithm"
                value={model_info.algorithm}
                icon={Brain}
              />
              <ModelInfoRow
                label="Features"
                value={formatNumber(model_info.features)}
                icon={BarChart3}
              />
              <ModelInfoRow
                label="Training Rows"
                value={formatNumber(model_info.training_rows)}
                icon={Activity}
              />
              <ModelInfoRow
                label="Test Rows"
                value={formatNumber(model_info.test_rows)}
                icon={Activity}
              />
              <ModelInfoRow
                label="Status"
                value={model_info.status}
                icon={Target}
              />
              <ModelInfoRow
                label="Trained At"
                value={new Date(model_info.trained_at).toLocaleString()}
                icon={Clock}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
          <h2 className="text-sm font-semibold text-slate-100">
            Feature Importance (stored, top 20)
          </h2>
          <div className="mt-4 h-96">
            {data.feature_importance &&
            data.feature_importance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.feature_importance.slice(0, 20)}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 140, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#27344A"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "#64748B", fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    width={130}
                    tick={{ fill: "#64748B", fontSize: 10 }}
                    stroke="#27344A"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "1px solid #27344a",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                    {data.feature_importance
                      .slice(0, 20)
                      .map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            i === 0
                              ? "#f97316"
                              : i < 5
                                ? "#f97316aa"
                                : "#f9731655"
                          }
                        />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-96 items-center justify-center text-xs text-faint">
                No stored feature importance
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}

export default ModelPerformance;
