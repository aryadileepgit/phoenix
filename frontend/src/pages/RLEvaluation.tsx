import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Loader2,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Table2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Target,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PhoenixLogo } from "../components/PhoenixLogo";
import { AppShell } from "../components/layout/AppShell";
import { StatCard } from "../components/StatCard";
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
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { getRLEvaluationRuns, createRLEvaluationRun, getRLEvaluationChart, getRLEvaluationSummary, getRLEvaluationBatches } from "../services/rlEvaluationService";

interface RLEvaluationRun {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  total_batches: number;
  batch_size: number;
  dataset_id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ChartData {
  reward_per_batch: { batch: number; reward: number }[];
  action_distribution: { ignore: number; retrain_new: number; retrain_mixed: number };
  baseline_vs_adaptive: {
    batch: number;
    adaptive_f1: number | null;
    baseline_f1: number | null;
    adaptive_precision: number | null;
    baseline_precision: number | null;
    adaptive_recall: number | null;
    baseline_recall: number | null;
  }[];
  per_batch_metrics: {
    batch: number;
    f1_before: number | null;
    f1_after: number | null;
    precision: number | null;
    recall: number | null;
    action: string | null;
    drift_detected: boolean;
    drift_score: number | null;
    schema_healed: boolean;
    reward: number;
  }[];
}

interface SummaryData {
  run_id: string;
  name: string;
  status: string;
  total_batches: number;
  completed_batches: number;
  avg_reward: number;
  total_reward: number;
  avg_f1_before: number;
  avg_f1_after: number;
  f1_improvement: number;
  action_distribution: { ignore: number; retrain_new: number; retrain_mixed: number };
  drift_batches: number;
  schema_healed_batches: number;
  duration_seconds: number | null;
}

function formatNumber(num: number | null, decimals = 4): string {
  if (num === null || num === undefined) return "—";
  return Number(num).toFixed(decimals);
}

function formatPercentage(num: number | null): string {
  if (num === null || num === undefined) return "—";
  return `${(num * 100).toFixed(2)}%`;
}

function getActionLabel(action: string | null): string {
  switch (action) {
    case "retrain_new": return "Retrain — New Data";
    case "retrain_mixed": return "Retrain — Mixed Memory";
    case "ignore": return "Ignore";
    default: return "—";
  }
}

export function RLEvaluation({ onLogout }: { onLogout: () => void }) {
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchRuns = async () => {
    try {
      const data = await getRLEvaluationRuns();
      setRuns(data);
    } catch (err) {
      console.error("Failed to fetch runs:", err);
    }
  };

  const handleSelectRun = async (runId: string) => {
    setSelectedRun(runId);
    setPage(1);
    setLoading(true);
    setError(null);
    try {
      const [chart, summary, batchesData] = await Promise.all([
        getRLEvaluationChart(runId),
        getRLEvaluationSummary(runId),
        getRLEvaluationBatches(runId),
      ]);
      setChartData(chart);
      setSummary(summary);
      setBatches(chart.per_batch_metrics);
    } catch (err: any) {
      setError(err.message || "Failed to load run data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRun = async () => {
    const name = prompt("Enter evaluation run name:");
    if (!name) return;

    setCreating(true);
    try {
      const run = await createRLEvaluationRun({
        name,
        dataset_id: "f99a1cac-51a4-4d18-9b82-a06d975dd97b",
        total_batches: 25,
        batch_size: 10000,
      });
      setSelectedRun(run.run_id);
      const poll = setInterval(async () => {
        try {
          await fetchRuns();
        } catch { }
      }, 3000);
      setTimeout(() => clearInterval(poll), 120000);
    } catch (err: any) {
      alert(err.message || "Failed to create run");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const totalPages = Math.ceil(chartData?.per_batch_metrics.length / pageSize) || 1;
  const paginatedBatches = chartData?.per_batch_metrics.slice(
    (page - 1) * pageSize,
    page * pageSize
  ) || [];

  function formatNumber(num: number | null, decimals = 4): string {
    if (num === null || num === undefined) return "—";
    return Number(num).toFixed(decimals);
  }

  function formatPercentage(num: number | null): string {
    if (num === null || num === undefined) return "—";
    return `${(num * 100).toFixed(2)}%`;
  }

  function getActionLabel(action: string | null): string {
    switch (action) {
      case "retrain_new": return "Retrain — New Data";
      case "retrain_mixed": return "Retrain — Mixed Memory";
      case "ignore": return "Ignore";
      default: return "—";
    }
  }

  const renderContent = () => {
    if (selectedRun && chartData) {
      return (
        <React.Fragment>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              icon={Zap}
              label="Avg Reward"
              value={formatNumber(summary.avg_reward)}
              iconColor="#f97316"
            />
            <StatCard
              icon={TrendingUp}
              label="Total Reward"
              value={formatNumber(summary.total_reward)}
              iconColor="#22c55e"
            />
            <StatCard
              icon={Target}
              label="F1 Improvement"
              value={formatPercentage(summary.f1_improvement)}
              iconColor="#3b82f6"
            />
            <StatCard
              icon={CheckCircle2}
              label="Avg F1 (After)"
              value={formatNumber(summary.avg_f1_after)}
              iconColor="#22c55e"
            />
            <StatCard
              icon={Zap}
              label="Total Reward"
              value={formatNumber(summary.total_reward)}
              iconColor="#a855f7"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Reward per Batch */}
            <div className="rounded-2xl border border-slate-600/50 bg-card p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-slate-100">Reward per Batch</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.reward_per_batch}>
                    <CartesianGrid stroke="#27344A" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="batch"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Batch #", position: "insideBottom", offset: -10, fill: "#64748B", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Reward", angle: -90, position: "insideLeft", offset: 20, fill: "#64748B", fontSize: 12 }}
                    />
<Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid #27344a", fontSize: 12 }}
                        labelStyle={{ color: "#e2e8f0" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [
                          typeof value === "number" ? value.toFixed(4) : "—",
                          "Reward",
                        ]}
                      />
                    <Bar
                      dataKey="reward"
                      fill="#f97316"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Action Distribution */}
            <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-100">RL Action Distribution</h2>
              <div className="h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={[
                        { name: "Retrain — New Data", value: chartData.action_distribution.retrain_new, color: "#ef4444" },
                        { name: "Retrain — Mixed Memory", value: chartData.action_distribution.retrain_mixed, color: "#f97316" },
                        { name: "Ignore", value: chartData.action_distribution.ignore, color: "#22c55e" },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent ?? 0 * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {[
                        { name: "Retrain — New Data", value: chartData.action_distribution.retrain_new, color: "#ef4444" },
                        { name: "Retrain — Mixed Memory", value: chartData.action_distribution.retrain_mixed, color: "#f97316" },
                        { name: "Ignore", value: chartData.action_distribution.ignore, color: "#22c55e" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
<Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid #27344a", fontSize: 12 }}
                        labelStyle={{ color: "#e2e8f0" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [value, "batches"]}
                      />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-3 h-3 rounded-full bg-red-400" />
                  Retrain New: {chartData.action_distribution.retrain_new}
                </span>
                <span className="flex items-center gap-1.5 text-orange-400">
                  <span className="w-3 h-3 rounded-full bg-orange-400" />
                  Retrain Mixed: {chartData.action_distribution.retrain_mixed}
                </span>
                <span className="flex items-center gap-1.5 text-green-400">
                  <span className="w-3 h-3 rounded-full bg-green-400" />
                  Ignore: {chartData.action_distribution.ignore}
                </span>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Baseline vs Adaptive F1 */}
            <div className="rounded-2xl border border-slate-600/50 bg-card p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-slate-100">F1 Score: Adaptive vs Static Baseline</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.baseline_vs_adaptive}>
                    <CartesianGrid stroke="#27344A" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="batch"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Batch #", position: "insideBottom", offset: -10, fill: "#64748B", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 1.05]}
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "F1 Score", angle: -90, position: "insideLeft", offset: 20, fill: "#64748B", fontSize: 12 }}
                    />
<Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid #27344a", fontSize: 12 }}
                        labelStyle={{ color: "#e2e8f0" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, name: any) => [
                          typeof value === "number" ? value.toFixed(4) : "—",
                          name === "adaptive_f1" ? "Adaptive F1" : "Baseline F1",
                        ]}
                      />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="adaptive_f1"
                      stroke="#22c55e"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                      name="Adaptive (RL)"
                    />
                    <Line
                      type="monotone"
                      dataKey="baseline_f1"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 5 }}
                      name="Baseline (Frozen)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* F1 Before/After per Batch */}
            <div className="rounded-2xl border border-slate-600/50 bg-card p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-slate-100">F1 Before vs After Action</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.per_batch_metrics}>
                    <CartesianGrid stroke="#27344A" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="batch"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Batch #", position: "insideBottom", offset: -10, fill: "#64748B", fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 1.05]}
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "F1 Score", angle: -90, position: "insideLeft", offset: 20, fill: "#64748B", fontSize: 12 }}
                    />
<Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid #27344a", fontSize: 12 }}
                        labelStyle={{ color: "#e2e8f0" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, name: any) => [
                          typeof value === "number" ? value.toFixed(4) : "—",
                          name === "f1_before" ? "F1 Before" : "F1 After",
                        ]}
                      />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="f1_before"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 4 }}
                      name="F1 Before"
                    />
                    <Line
                      type="monotone"
                      dataKey="f1_after"
                      stroke="#22c55e"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                      name="F1 After"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Per-Batch Metrics Table */}
          <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Per-Batch Metrics</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-600 rounded-lg"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 text-sm text-slate-300">
                  Page {page} / {Math.ceil((chartData?.per_batch_metrics?.length || 0) / 10)}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil((chartData?.per_batch_metrics?.length || 0) / 10), p + 1))}
                  disabled={page >= Math.ceil((chartData?.per_batch_metrics?.length || 0) / 10)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-600 rounded-lg"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-faint border-b border-card-border">
                    <th className="pb-3 pr-4">Batch</th>
                    <th className="pb-3 pr-4">Action</th>
                    <th className="pb-3 pr-4">F1 Before</th>
                    <th className="pb-3 pr-4">F1 After</th>
                    <th className="pb-3 pr-4">Precision</th>
                    <th className="pb-3 pr-4">Recall</th>
                    <th className="pb-3 pr-4">Drift</th>
                    <th className="pb-3 pr-4">Schema</th>
                    <th className="pb-3">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {paginatedBatches.map((b: any) => (
                    <tr key={b.batch} className="hover:bg-slate-800/50">
                      <td className="py-3 pr-4 font-mono text-slate-100">{b.batch}</td>
                      <td className="py-3 pr-4">
                        {b.action && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              b.action === "retrain_new"
                                ? "bg-red-500/20 text-red-400"
                                : b.action === "retrain_mixed"
                                ? "bg-orange-500/20 text-orange-400"
                                : "bg-green-500/20 text-green-400"
                              }`}
                          >
                            {getActionLabel(b.action)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-300">{formatNumber(b.f1_before)}</td>
                      <td className="py-3 pr-4 font-mono font-medium text-slate-100">{formatNumber(b.f1_after)}</td>
                      <td className="py-3 pr-4 font-mono text-slate-300">{formatPercentage(b.precision)}</td>
                      <td className="py-3 pr-4 font-mono text-slate-300">{formatPercentage(b.recall)}</td>
                      <td className="py-3 pr-4">
                        {b.drift_detected ? (
                          <span className="inline-flex items-center gap-1 text-orange-400">
                            <span className="w-2 h-2 rounded-full bg-orange-400" />
                            Drift ({formatNumber(b.drift_score, 2)})
                          </span>
                        ) : (
                          <span className="text-green-400">Clean</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {b.schema_healed ? (
                          <span className="inline-flex items-center gap-1 text-green-400">
                            <CheckCircle2 size={12} />
                            Healed
                          </span>
                        ) : (
                          <span className="text-slate-400">OK</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono font-medium text-slate-100">
                        {b.reward >= 0 ? "+" : ""}{formatNumber(b.reward, 4)}
                      </td>
                    </tr>
))}
                </tbody>
              </table>
            </div>
          </div>
        </React.Fragment>
      );
    }
    if (selectedRun && loading) {
      return (
        <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        </div>
      );
    }
    if (!selectedRun && runs.length > 0) {
      return (
        <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BarChart3 size={48} className="text-faint" />
            <p className="mt-4 text-lg text-slate-300">Select an evaluation run</p>
            <p className="mt-1 text-sm text-faint">Click a run from the table above to view detailed metrics and charts</p>
          </div>
        </div>
      );
    }
    if (runs.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Zap size={48} className="text-faint" />
            <p className="mt-4 text-lg text-slate-300">No evaluation runs yet</p>
            <p className="mt-1 text-sm text-faint">Click "New Evaluation Run" to start benchmarking the RL agent</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "RL Evaluation",
        description: "Virtual batch benchmarking for the adaptive fraud detection agent.",
        breadcrumb: "INTELLIGENCE / RL Evaluation",
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
            <PhoenixLogo size={24} className="inline mr-2" />
            <h1 className="text-xl font-bold text-slate-50 inline">RL Evaluation</h1>
          </div>
          <button
            onClick={handleCreateRun}
            disabled={creating}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(249,115,16,0.35)] hover:bg-primary-dark disabled:opacity-50"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {creating ? "Starting..." : "New Evaluation Run"}
          </button>
        </div>

        {/* Run selector */}
        <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-100">Evaluation Runs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-faint border-b border-card-border">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Batches</th>
                  <th className="pb-3 pr-4">Created</th>
                  <th className="pb-3 pr-4">Duration</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className={`hover:bg-slate-800/50 cursor-pointer ${
                      selectedRun === run.id ? "bg-primary/10" : ""
                    }`}
                    onClick={() => setSelectedRun(run.id)}
                  >
                    <td className="py-3 pr-4 font-medium text-slate-100">{run.name}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          run.status === "completed"
                            ? "bg-success/20 text-success"
                            : run.status === "running"
                            ? "bg-primary/20 text-primary"
                            : run.status === "failed"
                            ? "bg-destructive/20 text-destructive"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {run.status === "running" && <Loader2 size={10} className="animate-spin" />}
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{run.total_batches}</td>
                    <td className="py-3 pr-4 text-slate-300">
                      {new Date(run.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {run.completed_at && run.started_at
                        ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                        : "—"}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRun(run.id);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-faint">
                      No evaluation runs yet. Click "New Evaluation Run" to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {renderContent()}
      </motion.div>
    </AppShell>
  );
}
export default RLEvaluation;