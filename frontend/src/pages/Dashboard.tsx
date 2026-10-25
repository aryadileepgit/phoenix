import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Database as DatabaseIcon,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Activity,
  GitBranch,
  Shield,
  BrainCog,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { AppShell } from "../components/layout/AppShell";
import { getDashboardData } from "../services/dashboardService";
import type { DashboardData } from "../types/dashboard";

const RISK_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#facc15",
  HIGH: "#ef4444",
};

const DECISION_COLORS: Record<string, string> = {
  APPROVE: "#22c55e",
  VERIFY: "#facc15",
  BLOCK: "#ef4444",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) {
    return <span className="text-faint">—</span>;
  }
  const color = RISK_COLORS[level] ?? "#64748b";
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}1A`,
        color: color,
      }}
    >
      {level}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return <span className="text-faint">—</span>;
  }
  const color = DECISION_COLORS[decision] ?? "#64748b";
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}1A`,
        color: color,
      }}
    >
      {decision}
    </span>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  subLabel,
  iconColor,
}: {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  label: string;
  value: string | number;
  subLabel?: string;
  iconColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-slate-600/50 bg-card p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold text-slate-50">
            {value}
          </p>
          {subLabel && (
            <p className="mt-1.5 text-xs text-slate-500">{subLabel}</p>
          )}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${iconColor}1A`, color: iconColor }}
        >
          <Icon size={19} strokeWidth={2} />
        </div>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
}

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setData(await getDashboardData());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard data."
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Dashboard",
          description:
            "Real-time fraud monitoring and transaction intelligence",
          systemStatus: "online",
        }}
      >
        <div className="space-y-6">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-700" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton
                key={i}
                className="h-28 rounded-xl border border-slate-600/50 bg-card"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <LoadingSkeleton className="h-80 rounded-xl border border-slate-600/50 bg-card xl:col-span-2" />
            <LoadingSkeleton className="h-80 rounded-xl border border-slate-600/50 bg-card" />
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
          title: "Dashboard",
          description:
            "Real-time fraud monitoring and transaction intelligence",
          systemStatus: "error",
        }}
      >
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error ?? "Failed to load dashboard data."}
        </div>
      </AppShell>
    );
  }

  const {
    kpis,
    model,
    drift,
    riskDistribution,
    decisionDistribution,
    recentTransactions,
    fraudActivity,
    system,
  } = data;

  const riskBars = [
    { name: "LOW", value: riskDistribution.LOW, color: "#22c55e" },
    { name: "MEDIUM", value: riskDistribution.MEDIUM, color: "#facc15" },
    { name: "HIGH", value: riskDistribution.HIGH, color: "#ef4444" },
  ];
  const decisionPie = [
    { name: "APPROVE", value: decisionDistribution.APPROVE, color: "#22c55e" },
    { name: "VERIFY", value: decisionDistribution.VERIFY, color: "#facc15" },
    { name: "BLOCK", value: decisionDistribution.BLOCK, color: "#ef4444" },
  ];

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Dashboard",
        description:
          "Real-time fraud monitoring and transaction intelligence",
        systemStatus: "online",
        systemStatusLabel: "Phoenix Engine Online",
        modelVersion: model ? model.name : "No model",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            icon={DatabaseIcon}
            label="Total Transactions"
            value={formatNumber(kpis.totalTransactions)}
            subLabel="Stored scored rows"
            iconColor="#3b82f6"
          />
          <KPICard
            icon={ShieldAlert}
            label="Fraud Detected"
            value={formatNumber(kpis.fraudDetected)}
            subLabel="Predicted fraud"
            iconColor="#ef4444"
          />
          <KPICard
            icon={AlertTriangle}
            label="High Risk"
            value={formatNumber(kpis.highRiskTransactions)}
            subLabel="Risk level HIGH"
            iconColor="#f97316"
          />
          <KPICard
            icon={Shield}
            label="Verification Queue"
            value={formatNumber(kpis.verificationRequired)}
            subLabel="Decision VERIFY"
            iconColor="#facc15"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            icon={TrendingUp}
            label="Model Accuracy"
            value={model ? formatPercentage(model.accuracy) : "—"}
            subLabel={model ? model.name : "No model report"}
            iconColor="#22c55e"
          />
          <KPICard
            icon={TrendingUp}
            label="Model ROC-AUC"
            value={model ? formatPercentage(model.roc_auc) : "—"}
            subLabel={model ? model.name : "No model report"}
            iconColor="#2563eb"
          />
          <KPICard
            icon={Activity}
            label="Drift Status"
            value={
              drift.status === "never_run"
                ? "Never run"
                : drift.status === "drift"
                  ? "Drift"
                  : "Stable"
            }
            subLabel={
              drift.last_check
                ? new Date(drift.last_check).toLocaleString()
                : "Run drift detection first"
            }
            iconColor={
              drift.status === "drift" ? "#ef4444" : "#22c55e"
            }
          />
          <KPICard
            icon={GitBranch}
            label="Schema Pending"
            value={formatNumber(system.schemaPendingMappings)}
            subLabel="Mappings awaiting review"
            iconColor="#f97316"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-600/50 bg-card p-5 xl:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Transaction Risk Overview
              </h2>
              <span className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400">
                Stored rows
              </span>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={riskBars}
                  margin={{ left: -20, right: 10, top: 10 }}
                >
                  <CartesianGrid
                    stroke="#1E293B"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1E293B",
                      border: "1px solid #27344A",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {riskBars.map((b) => (
                      <Cell key={b.name} fill={b.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-600/50 bg-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Decision Distribution
            </h2>
            <div className="relative mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decisionPie}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {decisionPie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-bold text-slate-50">
                  {formatNumber(kpis.totalTransactions)}
                </p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
            <div className="mt-2 space-y-2">
              {decisionPie.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-slate-300">{d.name}</span>
                  </div>
                  <span className="font-medium text-slate-200">
                    {formatNumber(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-600/50 bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Recent Transactions
            </h2>
            <button
              type="button"
              onClick={() => navigate("/transactions")}
              className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:border-primary/50 hover:text-primary"
            >
              View all
            </button>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="py-8 text-center text-xs text-faint">
              No scored transactions yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-xs">
                <thead>
                  <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-3 py-2.5 font-medium">
                      Transaction ID
                    </th>
                    <th className="px-3 py-2.5 font-medium">Account</th>
                    <th className="px-3 py-2.5 font-medium">Amount</th>
                    <th className="px-3 py-2.5 font-medium">Time</th>
                    <th className="px-3 py-2.5 font-medium">
                      Fraud Probability
                    </th>
                    <th className="px-3 py-2.5 font-medium">Risk</th>
                    <th className="px-3 py-2.5 font-medium">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((txn) => (
                    <tr
                      key={txn.transaction_id}
                      onClick={() =>
                        navigate(
                          `/transactions/${encodeURIComponent(
                            txn.transaction_id
                          )}`
                        )
                      }
                      className="cursor-pointer border-b border-card-border/40 transition-colors last:border-0 hover:bg-bg/40"
                    >
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                        {txn.transaction_id}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                        {txn.account_id}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {formatCurrency(txn.amount)}
                      </td>
                      <td className="px-3 py-2.5 text-faint">
                        {new Date(txn.transaction_time).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {txn.fraud_probability !== null
                          ? `${(txn.fraud_probability * 100).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <RiskBadge level={txn.risk_level} />
                      </td>
                      <td className="px-3 py-2.5">
                        <DecisionBadge decision={txn.decision} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-600/50 bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Fraud Activity
            </h2>
            <span className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400">
              Daily scored volume
            </span>
          </div>
          <div className="mt-4 h-56">
            {fraudActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={fraudActivity}
                  margin={{ left: -20, right: 10, top: 10 }}
                >
                  <defs>
                    <linearGradient
                      id="fraudActivityFill"
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
                  <CartesianGrid stroke="#1E293B" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => (v ? v.slice(5, 10) : "")}
                  />
                  <YAxis
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1E293B",
                      border: "1px solid #27344A",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="fraud"
                    name="Fraud"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#fraudActivityFill)"
                    dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="highRisk"
                    name="High Risk"
                    stroke="#facc15"
                    strokeWidth={2}
                    fill="none"
                    dot={{ r: 2, fill: "#facc15", strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="blocked"
                    name="Blocked"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="none"
                    dot={{ r: 2, fill: "#f97316", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-56 items-center justify-center text-xs text-faint">
                No scored activity yet
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            icon={BrainCog}
            label="Model"
            value={model ? model.name : "No model report"}
            subLabel={
              model ? `Accuracy ${formatPercentage(model.accuracy)}` : "—"
            }
            iconColor="#22c55e"
          />
          <KPICard
            icon={Activity}
            label="Drift"
            value={
              drift.status === "never_run"
                ? "Never run"
                : drift.status === "drift"
                  ? `Drift (${drift.severity ?? ""})`
                  : "Stable"
            }
            subLabel={
              drift.last_check
                ? new Date(drift.last_check).toLocaleString()
                : "Run drift detection first"
            }
            iconColor={
              drift.status === "drift" ? "#ef4444" : "#22c55e"
            }
          />
          <KPICard
            icon={GitBranch}
            label="Schema Pending"
            value={formatNumber(system.schemaPendingMappings)}
            subLabel="Mappings awaiting review"
            iconColor="#f97316"
          />
          <KPICard
            icon={ShieldCheck}
            label="Last Retraining"
            value={
              system.retrainingActive
                ? "Running…"
                : system.lastRetraining
                  ? new Date(system.lastRetraining).toLocaleString()
                  : "Never"
            }
            subLabel="Recorded runs only"
            iconColor="#3b82f6"
          />
        </div>
      </motion.div>
    </AppShell>
  );
}

export default Dashboard;
