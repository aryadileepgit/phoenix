import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BrainCog,
  Play,
  Loader2,
  Award,
  TrendingUp,
  Target,
  Zap,
  AlertTriangle,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import {
  getAdaptiveLearning,
  requestAdaptiveDecision,
} from "../services/adaptiveService";
import { safeNumber, formatNumber } from "../utils/format";
import type { AdaptiveState } from "../types/adaptive";

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
}

function StatCard({
  icon: Icon,
  label,
  value,
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
  bg?: string;
  iconColor?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-600/50 ${bg} p-5`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold text-slate-50">
            {value}
          </p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${iconColor}1A`, color: iconColor }}
        >
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-primary" />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <span className="text-sm font-bold text-slate-100">{value}</span>
    </div>
  );
}

export function AdaptiveLearning({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<AdaptiveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [decision, setDecision] = useState<{
    state: string;
    action: string;
    message: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdaptiveLearning();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load adaptive learning state."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // While a background job is active, refresh state silently
  // every 15s so progress completes without manual reloads.
  useEffect(() => {
    if (!data?.worker) {
      return;
    }
    const timer = setInterval(() => {
      getAdaptiveLearning()
        .then(setData)
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [data?.worker]);

  const handleDecide = async () => {
    setDeciding(true);
    setError(null);
    try {
      const result = await requestAdaptiveDecision();
      setDecision({
        state: result.state,
        action: result.action,
        message: result.message,
      });
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Decision request failed."
      );
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Adaptive Retraining",
          description:
            "Q-learning agent state and recorded retraining history.",
          breadcrumb: "INTELLIGENCE / Adaptive Retraining",
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
          title: "Adaptive Retraining",
          description:
            "Q-learning agent state and recorded retraining history.",
          breadcrumb: "INTELLIGENCE / Adaptive Retraining",
          systemStatus: "error",
        }}
      >
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error || "Failed to load adaptive learning data"}
        </div>
      </AppShell>
    );
  }

  const { agent, latest_drift_event, last_decision, q_table } = data;

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Adaptive Retraining",
        description:
          "Q-learning agent state and recorded retraining history.",
        breadcrumb: "INTELLIGENCE / Adaptive Retraining",
        systemStatus: "online",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={BrainCog}
            label="Agent (α/γ/ε)"
            value={`${agent.alpha} / ${agent.gamma} / ${agent.epsilon}`}
            iconColor="#f97316"
          />
          <StatCard
            icon={Target}
            label="Latest Drift"
            value={
              latest_drift_event
                ? `${latest_drift_event.severity} · KS ${latest_drift_event.ks_score.toFixed(4)}`
                : "No drift run yet"
            }
            iconColor="#3b82f6"
          />
          <StatCard
            icon={Award}
            label="Last Decision"
            value={last_decision ? last_decision.action : "None recorded"}
            iconColor="#facc15"
          />
          <StatCard
            icon={TrendingUp}
            label="Model ROC-AUC"
            value={
              data.model_evaluation
                ? formatPercentage(data.model_evaluation.roc_auc)
                : "—"
            }
            iconColor="#22c55e"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Agent Recommendation
            </h2>
            <p className="mt-1 text-xs text-faint">
              Runs the real Q-learning agent against the latest
              drift event. Nothing is retrained by this call.
            </p>
            <button
              type="button"
              onClick={handleDecide}
              disabled={deciding || !latest_drift_event}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {deciding ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              {deciding
                ? "Consulting agent..."
                : "Request Agent Decision"}
            </button>
            {!latest_drift_event && (
              <p className="mt-3 text-xs text-warning">
                No drift event exists yet — run drift detection
                first (Concept Drift page).
              </p>
            )}
            {decision && (
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-primary" />
                  <p className="text-sm font-bold text-slate-100">
                    {decision.action}
                  </p>
                </div>
                <p className="mt-1 text-xs text-faint">
                  State {decision.state}
                </p>
                <p className="mt-2 text-xs text-primary">
                  {decision.message}
                </p>
              </div>
            )}
            {last_decision && !decision && (
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-4 py-2.5">
                  <span className="text-faint">Recorded action</span>
                  <span className="font-bold text-slate-100">
                    {last_decision.action}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-4 py-2.5">
                  <span className="text-faint">State / reward</span>
                  <span className="font-mono text-slate-100">
                    {last_decision.state} ·{" "}
                    {safeNumber(last_decision.reward, "0.00")}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-card-border bg-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Model Evaluation
            </h2>
            {data.model_evaluation ? (
              <div className="mt-4 space-y-3">
                <MetricRow
                  icon={Target}
                  label="Accuracy"
                  value={formatPercentage(data.model_evaluation.accuracy)}
                />
                <MetricRow
                  icon={Target}
                  label="Precision"
                  value={formatPercentage(
                    data.model_evaluation.precision
                  )}
                />
                <MetricRow
                  icon={Target}
                  label="Recall"
                  value={formatPercentage(data.model_evaluation.recall)}
                />
                <MetricRow
                  icon={Target}
                  label="F1 Score"
                  value={formatPercentage(
                    data.model_evaluation.f1_score
                  )}
                />
                <MetricRow
                  icon={TrendingUp}
                  label="ROC-AUC"
                  value={formatPercentage(
                    data.model_evaluation.roc_auc
                  )}
                />
              </div>
            ) : (
              <div className="mt-4 flex h-32 items-center justify-center text-xs text-faint">
                No model evaluation data
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Q-Table Snapshot
            </h2>
            <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">
              {q_table.length} state-action rows
            </span>
          </div>
          {q_table.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Inbox size={20} className="text-faint" />
              <p className="text-xs text-faint">
                Agent has never acted — request a decision to
                initialize the Q-table.
              </p>
            </div>
          ) : (
            <div className="mt-4 max-h-64 overflow-y-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-3 py-2.5 font-medium">State</th>
                    <th className="px-3 py-2.5 font-medium">Action</th>
                    <th className="px-3 py-2.5 font-medium">Q-Value</th>
                    <th className="px-3 py-2.5 font-medium">Reward</th>
                    <th className="px-3 py-2.5 font-medium">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {q_table.slice(0, 30).map((r, i) => (
                    <tr
                      key={`${r.state}-${r.action}-${i}`}
                      className="border-b border-card-border/40 hover:bg-bg/40"
                    >
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {r.state}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {r.action}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {safeNumber(r.q_value, "0.000")}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {safeNumber(r.reward, "0.00")}
                      </td>
                      <td className="px-3 py-2.5 text-faint">
                        {new Date(r.recorded_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Supervised Ground Truth
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                data.label_stats.eligible
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-warning/25 bg-warning/10 text-warning"
              }`}
            >
              {data.label_stats.eligible
                ? "RETRAIN_ELIGIBLE"
                : "NOT ELIGIBLE"}
            </span>
          </div>
          <p className="mt-1 text-xs text-faint">
            Distinct analyst-verified transactions only.
            Unlabeled rows are never ground truth. RETRAIN_RECENT
            requires {data.label_stats.min_required} labeled rows.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
              <p className="text-[10px] text-faint">Labeled Total</p>
              <p className="mt-1 text-lg font-bold text-slate-100">
                {formatNumber(data.label_stats.labeled_total)}
              </p>
            </div>
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
              <p className="text-[10px] text-faint">Confirmed Fraud</p>
              <p className="mt-1 text-lg font-bold text-danger">
                {formatNumber(data.label_stats.confirmed_fraud)}
              </p>
            </div>
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
              <p className="text-[10px] text-faint">
                Confirmed Legitimate
              </p>
              <p className="mt-1 text-lg font-bold text-success">
                {formatNumber(data.label_stats.confirmed_legitimate)}
              </p>
            </div>
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
              <p className="text-[10px] text-faint">Minimum Required</p>
              <p className="mt-1 text-lg font-bold text-slate-100">
                {formatNumber(data.label_stats.min_required)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Background Worker
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                data.worker
                  ? "border-warning/25 bg-warning/10 text-warning"
                  : "border-success/25 bg-success/10 text-success"
              }`}
            >
              {data.worker ? data.worker.status.toUpperCase() : "IDLE"}
            </span>
          </div>
          {data.worker ? (
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-4 py-2.5">
                <span className="text-faint">Job / action</span>
                <span className="font-mono text-slate-100">
                  {data.worker.job_id} · {data.worker.action}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-card-border/70 bg-bg/40 px-4 py-2.5">
                <Loader2 size={13} className="animate-spin text-warning" />
                <span className="text-slate-300">
                  {data.worker.progress}
                </span>
              </div>
              <p className="text-[11px] text-faint">
                Live scoring continues on the deployed model
                meanwhile; this view refreshes automatically.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-faint">
              No retraining job running. Jobs start only when a
              drift run ends with drift detected, Q-learning
              selects retraining, cooldown has passed, and no
              other job is active.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Recent Jobs (durable record)
            </h2>
            <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">
              {data.recent_jobs.length} jobs
            </span>
          </div>
          {data.recent_jobs.length === 0 ? (
            <p className="mt-4 text-xs text-faint">
              No retraining jobs have ever been queued —
              including failed ones. Failures are recorded here
              with their error, never hidden.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {data.recent_jobs.map((job) => (
                <div
                  key={job.job_id}
                  className="rounded-xl border border-card-border/70 bg-bg/40 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-200">
                      {job.job_id} · {job.action}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        job.status === "succeeded"
                          ? "border-success/25 bg-success/10 text-success"
                          : job.status === "failed"
                            ? "border-danger/25 bg-danger/10 text-danger"
                            : "border-warning/25 bg-warning/10 text-warning"
                      }`}
                    >
                      {job.status.toUpperCase()}
                    </span>
                  </div>
                  {job.error && (
                    <p className="mt-1.5 break-words font-mono text-[10px] text-danger/90">
                      {job.error.slice(0, 300)}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-faint">
                    {job.started_at
                      ? new Date(job.started_at).toLocaleString()
                      : "not started"}
                    {job.finished_at
                      ? ` → ${new Date(job.finished_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Retraining History
            </h2>
            <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">
              {data.retraining_history.length} records
            </span>
          </div>
          {data.retraining_history.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Inbox size={20} className="text-faint" />
              <p className="text-xs text-faint">
                No retraining runs recorded — the deployed model
                has never been replaced. Retraining executes
                only through the dataset pipeline, never
                automatically.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-3 py-2.5 font-medium">Run</th>
                    <th className="px-3 py-2.5 font-medium">Action</th>
                    <th className="px-3 py-2.5 font-medium">Reward</th>
                    <th className="px-3 py-2.5 font-medium">
                      Duration (s)
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.retraining_history.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-card-border/40 hover:bg-bg/40"
                    >
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {r.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {r.action}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {safeNumber(r.reward, "0.00")}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {formatNumber(r.training_duration_seconds)}
                      </td>
                      <td className="px-3 py-2.5 text-faint">
                        {new Date(r.completed_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pb-2 text-xs text-slate-500">
          <AlertTriangle size={13} className="text-warning" />
          The agent recommends; it never replaces the deployed
          model on its own.
        </div>
      </motion.div>
    </AppShell>
  );
}

export default AdaptiveLearning;
