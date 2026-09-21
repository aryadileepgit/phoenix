import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Clock,
  AlertTriangle,
  Play,
  Loader2,
  Gauge,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  getDriftStatus,
  runDriftDetection,
} from "../services/driftService";
import { safeNumber } from "../utils/format";
import type { DriftStatusResponse } from "../types/drift";

const DRIFT_STATUS_COLORS: Record<string, string> = {
  STABLE: "text-success bg-success/10 border-success/25",
  WARNING: "text-warning bg-warning/10 border-warning/25",
  DRIFT: "text-danger bg-danger/10 border-danger/25",
};

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
}

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaPositive,
  bg = "bg-card",
  iconColor = "#f97316",
}: {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  bg?: string;
  iconColor?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-600/50 ${bg} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-50">{value}</p>
          {delta && (
            <p
              className="mt-1.5 text-xs"
              style={{ color: deltaPositive ? "#22c55e" : "#ef4444" }}
            >
              {delta}
            </p>
          )}
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

function DriftStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
        DRIFT_STATUS_COLORS[status] ??
        "text-slate-400 bg-slate-500/10 border-slate-500/25"
      }`}
    >
      {status}
    </span>
  );
}

export function DriftMonitoring({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<DriftStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDriftStatus();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load drift status."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunDrift = async () => {
    setRunning(true);
    setRunMessage(null);
    try {
      const result = await runDriftDetection();
      setRunMessage(
        result.drift_detected
          ? `Drift detected (KS ${result.ks_score.toFixed(4)}, ${result.severity}). Persisted as event ${result.drift_event_id.slice(0, 8)}.`
          : `No drift (KS ${result.ks_score.toFixed(4)} ≤ ${result.threshold}). Run persisted.`
      );
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to run drift detection."
      );
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Concept Drift",
          description:
            "Monitor changes in scored transaction patterns over time.",
          breadcrumb: "INTELLIGENCE / Concept Drift",
          systemStatus: "online",
        }}
      >
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-slate-700" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton
                key={i}
                className="h-28 rounded-xl border border-slate-600/50 bg-card p-5"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LoadingSkeleton className="h-80 rounded-xl border border-slate-600/50 bg-card p-5 lg:col-span-2" />
            <LoadingSkeleton className="h-80 rounded-xl border border-slate-600/50 bg-card p-5" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Concept Drift",
          description:
            "Monitor changes in scored transaction patterns over time.",
          breadcrumb: "INTELLIGENCE / Concept Drift",
          systemStatus: "error",
        }}
      >
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error || "Failed to load drift data"}
        </div>
      </AppShell>
    );
  }

  const { status, features, events, fraud_rate_history } = data;

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Concept Drift",
        description:
          "Monitor changes in scored transaction patterns over time.",
        breadcrumb: "INTELLIGENCE / Concept Drift",
        systemStatus: status.drift_detected ? "warning" : "online",
        systemStatusLabel: status.drift_detected
          ? "Drift Detected"
          : status.last_check
            ? "Monitoring Stable"
            : "Never Run",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {status.note && (
          <div className="rounded-xl border border-card-border bg-card px-4 py-3 text-xs text-muted">
            {status.note}
          </div>
        )}
        {runMessage && (
          <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-xs font-medium text-success">
            {runMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Gauge}
            label="KS Score"
            value={safeNumber(status.ks_score, "0.000")}
            delta={
              status.last_check
                ? status.ks_score > status.threshold
                  ? "Above threshold"
                  : "Below threshold"
                : "No run yet"
            }
            deltaPositive={
              !status.last_check || status.ks_score <= status.threshold
            }
            iconColor="#f97316"
          />
          <StatCard
            icon={AlertTriangle}
            label="Threshold"
            value={safeNumber(status.threshold, "0.000")}
            iconColor="#facc15"
          />
          <StatCard
            icon={Activity}
            label="Drift Detected"
            value={
              !status.last_check
                ? "Never run"
                : status.drift_detected
                  ? "Yes"
                  : "No"
            }
            deltaPositive={!status.drift_detected}
            bg={status.drift_detected ? "bg-danger/10" : "bg-success/10"}
            iconColor={status.drift_detected ? "#ef4444" : "#22c55e"}
          />
          <StatCard
            icon={Clock}
            label="Last Check"
            value={
              status.last_check
                ? new Date(status.last_check).toLocaleString()
                : "—"
            }
            iconColor="#3b82f6"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          <div className="rounded-2xl border border-card-border bg-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Daily Fraud Rate (scored transactions)
              </h2>
              <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">
                {status.reference_size ?? 0} ref /{" "}
                {status.recent_size ?? 0} recent rows
              </span>
            </div>
            <div className="mt-4 h-56">
              {fraud_rate_history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={fraud_rate_history}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="driftRateFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#f97316"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="#f97316"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="#27344A"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) =>
                        v ? v.slice(0, 10) : ""
                      }
                    />
                    <YAxis
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid #27344a",
                        fontSize: 12,
                      }}
                      formatter={(value: any) => [
                        formatRate(Number(value)),
                        "Fraud Rate",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="fraud_rate"
                      stroke="#f97316"
                      strokeWidth={2}
                      fill="url(#driftRateFill)"
                      dot={{ r: 3, fill: "#f97316" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-56 items-center justify-center text-xs text-faint">
                  No fraud rate history
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-card-border bg-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Drift Status
            </h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">KS Score</span>
                <span
                  className={`text-sm font-bold ${
                    status.last_check &&
                    status.ks_score > status.threshold
                      ? "text-danger"
                      : "text-success"
                  }`}
                >
                  {safeNumber(status.ks_score, "0.000")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Threshold</span>
                <span className="text-sm font-bold text-slate-200">
                  {safeNumber(status.threshold, "0.000")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">
                  Fraud Rate Change
                </span>
                <span className="text-sm font-bold text-slate-200">
                  {formatRate(status.fraud_rate_change)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">
                  Features Monitored
                </span>
                <span className="text-sm font-bold text-slate-200">
                  {status.features_monitored}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">
                  Drifted Features
                </span>
                <span className="text-sm font-bold text-danger">
                  {status.drifted_features ?? "—"}
                </span>
              </div>
              <button
                onClick={handleRunDrift}
                disabled={running}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {running ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} />
                )}
                {running ? "Running..." : "Run Drift Detection"}
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-card-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Feature Drift Analysis
            </h2>
            <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">
              {features.length} features · reference = older half,
              recent = newer half
            </span>
          </div>
          {features.length === 0 ? (
            <p className="py-8 text-center text-xs text-faint">
              No feature snapshot yet — run drift detection first.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-3 py-2.5 font-medium">Feature</th>
                    <th className="px-3 py-2.5 font-medium">
                      KS Statistic
                    </th>
                    <th className="px-3 py-2.5 font-medium">p-value</th>
                    <th className="px-3 py-2.5 font-medium">
                      Drift Status
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Ref Mean
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Recent Mean
                    </th>
                    <th className="px-3 py-2.5 font-medium">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {features
                    .slice()
                    .sort((a, b) => b.ks_statistic - a.ks_statistic)
                    .map((f) => (
                      <tr
                        key={f.feature}
                        className="border-b border-card-border/40 hover:bg-bg/40"
                      >
                        <td className="px-3 py-2.5 font-mono text-slate-300">
                          {f.feature}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-300">
                          {f.ks_statistic.toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-300">
                          {f.p_value.toExponential(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          <DriftStatusBadge
                            status={f.drift_status}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {f.reference_mean.toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {f.recent_mean.toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 text-faint">
                          {f.reference_size}/{f.recent_size}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-card-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Persisted Drift Runs
            </h2>
            <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">
              {events.length} runs
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {events.length > 0 ? (
              events.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle
                      size={15}
                      className={
                        e.severity === "High"
                          ? "text-danger"
                          : e.severity === "Medium"
                            ? "text-warning"
                            : "text-success"
                      }
                    />
                    <div>
                      <p className="font-mono text-sm text-slate-200">
                        KS {e.ks_score.toFixed(4)} vs{" "}
                        {e.threshold.toFixed(3)}
                      </p>
                      <p className="text-xs text-faint">
                        {e.drift_detected
                          ? "Drift detected"
                          : "No drift"}{" "}
                        · {e.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        e.severity === "High"
                          ? "border-danger/25 bg-danger/10 text-danger"
                          : e.severity === "Medium"
                            ? "border-warning/25 bg-warning/10 text-warning"
                            : "border-success/25 bg-success/10 text-success"
                      }`}
                    >
                      {e.severity}
                    </span>
                    <span className="text-xs text-faint">
                      {new Date(e.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-faint">
                No drift runs recorded
              </div>
            )}
          </div>
        </motion.div>

        <div className="rounded-xl border border-slate-600/50 bg-bg/40 p-4 text-xs text-faint">
          <p className="mb-1 font-medium text-slate-300">Note:</p>
          <p>
            Retraining is never triggered automatically — not even
            when p-values are significant. Use the configured KS
            and fraud-rate thresholds, then review the Adaptive
            Retraining recommendation.
          </p>
        </div>
      </motion.div>
    </AppShell>
  );
}

export default DriftMonitoring;
