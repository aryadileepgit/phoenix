import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShieldAlert,
  TrendingUp,
  AlertTriangle,
  User,
  CreditCard,
  BarChart3,
  Network,
  Search,
  ArrowLeft,
  RefreshCw,
  Inbox,
  CheckCircle2,
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
  LineChart,
  Line,
} from "recharts";
import {
  getAccountRisk,
  getAccountHistory,
  getAccountInvestigation,
} from "../services/accountsService";
import { safeNumber, formatNumber } from "../utils/format";
import type {
  AccountRiskResponse,
  AccountHistoryResponse,
  AccountInvestigationResponse,
  AccountRiskLevel,
} from "../types/accounts";

const RISK_COLORS: Record<AccountRiskLevel, string> = {
  LOW: "#22c55e",
  MEDIUM: "#facc15",
  HIGH: "#ef4444",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatProbability(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function RiskBadge({ level }: { level: AccountRiskLevel }) {
  const color = RISK_COLORS[level];
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

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
}

export function AccountRisk({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get("account") ?? "";

  const [risk, setRisk] = useState<AccountRiskResponse | null>(null);
  const [history, setHistory] =
    useState<AccountHistoryResponse | null>(null);
  const [investigation, setInvestigation] =
    useState<AccountInvestigationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [riskData, historyData, investigationData] =
        await Promise.all([
          getAccountRisk(accountId),
          getAccountHistory(accountId),
          getAccountInvestigation(accountId),
        ]);
      setRisk(riskData);
      setHistory(historyData);
      setInvestigation(investigationData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load account risk."
      );
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const topbar = {
    title: "Account Risk",
    description:
      "Scored transaction behavior for one API-supplied account.",
    breadcrumb: accountId
      ? `DATA / Accounts / ${accountId}`
      : "DATA / Accounts / Risk",
    systemStatus: "online" as const,
  };

  if (!accountId) {
    return (
      <AppShell onLogout={onLogout} topbar={topbar}>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-card-border bg-card p-12 text-center">
          <Inbox size={28} className="text-faint" />
          <p className="text-sm text-slate-300">
            No account selected.
          </p>
          <p className="max-w-md text-xs text-faint">
            Pick an account from the Accounts list. Accounts
            are API-supplied identifiers from scored
            transactions (IEEE-CIS has no native account
            column).
          </p>
          <button
            type="button"
            onClick={() => navigate("/accounts")}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <ArrowLeft size={13} />
            Back to Accounts
          </button>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell onLogout={onLogout} topbar={topbar}>
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
          <LoadingSkeleton className="h-64 rounded-xl border border-slate-600/50 bg-card p-5" />
          <LoadingSkeleton className="h-64 rounded-xl border border-slate-600/50 bg-card p-5" />
        </div>
      </AppShell>
    );
  }

  if (error || !risk || !history) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{ ...topbar, systemStatus: "error" as const }}
      >
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error || `No transactions found for account ${accountId}`}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
          >
            <RefreshCw size={13} />
            Retry
          </button>
          <button
            type="button"
            onClick={() => navigate("/accounts")}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
          >
            <ArrowLeft size={13} />
            Back to Accounts
          </button>
        </div>
      </AppShell>
    );
  }

  const amounts = history.transactions.map((t) => t.amount);
  const totalAmount = amounts.reduce((s, a) => s + a, 0);
  const avgAmount =
    amounts.length > 0 ? totalAmount / amounts.length : 0;
  const fraudPredicted = history.transactions.filter(
    (t) => t.predicted_label === true
  ).length;
  const highestProb = history.transactions.reduce<number | null>(
    (max, t) =>
      t.fraud_probability !== null &&
      (max === null || t.fraud_probability > max)
        ? t.fraud_probability
        : max,
    null
  );

  const chronological = history.transactions.slice().reverse();
  const probSeries = chronological
    .map((t, i) => ({
      i,
      time: t.transaction_time,
      probability:
        t.fraud_probability !== null
          ? Number((t.fraud_probability * 100).toFixed(2))
          : null,
    }))
    .filter((p) => p.probability !== null);
  const amountSeries = chronological.map((t, i) => ({
    i,
    time: t.transaction_time,
    amount: t.amount,
  }));

  return (
    <AppShell onLogout={onLogout} topbar={topbar}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Account ID</p>
            <h1 className="font-mono text-2xl font-bold text-slate-50">
              {risk.account_id}
            </h1>
            <p className="mt-1 text-xs text-faint">
              API-supplied identifier from scored transactions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RiskBadge level={risk.account_risk} />
            {risk.investigation_required && (
              <span className="rounded-full border border-danger/25 bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
                INVESTIGATION REQUIRED
              </span>
            )}
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={AlertTriangle}
            label="Current Risk"
            value={`${risk.account_risk} · ${risk.risk_score}`}
            iconColor={RISK_COLORS[risk.account_risk]}
          />
          <StatCard
            icon={TrendingUp}
            label="Total Transactions"
            value={safeNumber(risk.total_transactions)}
          />
          <StatCard
            icon={CreditCard}
            label="Total / Avg Amount"
            value={`${formatCurrency(totalAmount)} / ${formatCurrency(
              Math.round(avgAmount)
            )}`}
          />
          <StatCard
            icon={ShieldAlert}
            label="Fraud Predicted"
            value={safeNumber(fraudPredicted)}
            bg="bg-danger/10"
          />
          <StatCard
            icon={BarChart3}
            label="Highest Fraud Probability"
            value={formatProbability(highestProb)}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Fraud Probability Over Time
            </h2>
            <div className="mt-4 h-64">
              {probSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={probSeries}
                    margin={{ left: -20, right: 10, top: 10 }}
                  >
                    <CartesianGrid
                      stroke="#1E293B"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="i"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1E293B",
                        border: "1px solid #27344A",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      formatter={(value: any) => [
                        value !== undefined ? `${value}%` : "—",
                        "Fraud Probability",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="probability"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#ef4444" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-faint">
                  No scored probabilities for this account
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Transaction Amounts Over Time
            </h2>
            <div className="mt-4 h-64">
              {amountSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={amountSeries}
                    margin={{ left: -20, right: 10, top: 10 }}
                  >
                    <defs>
                      <linearGradient
                        id="amountFill"
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
                      stroke="#1E293B"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="i"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1E293B",
                        border: "1px solid #27344A",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                      formatter={(value: any) => [
                        value !== undefined
                          ? formatCurrency(Number(value))
                          : "—",
                        "Amount",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fill="url(#amountFill)"
                      dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-faint">
                  No transaction activity data
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-slate-600/50 bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Recent Activity
            </h2>
            <span className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400">
              {history.transactions.length} transactions
            </span>
          </div>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {history.transactions.slice(0, 20).map((txn) => (
              <div
                key={txn.transaction_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-card-border/70 bg-bg/40 px-4 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AlertTriangle
                    size={14}
                    className={
                      txn.risk_level === "HIGH"
                        ? "shrink-0 text-danger"
                        : txn.risk_level === "MEDIUM"
                          ? "shrink-0 text-warning"
                          : "shrink-0 text-success"
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-slate-200">
                      {txn.transaction_id}
                    </p>
                    <p className="text-[10px] text-faint">
                      {new Date(
                        txn.transaction_time
                      ).toLocaleString()}{" "}
                      ·{" "}
                      {txn.predicted_label === true
                        ? "predicted fraud"
                        : "predicted legitimate"}{" "}
                      · {txn.decision ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-slate-300">
                    {formatProbability(txn.fraud_probability)}
                  </span>
                  <span className="text-sm font-bold text-slate-100">
                    {formatCurrency(txn.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Factors + Investigation */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-danger" />
              <h2 className="text-sm font-semibold text-slate-100">
                Risk Factors
              </h2>
              <span className="ml-auto text-xs text-faint">
                Backend signals, not proof of fraud
              </span>
            </div>
            {risk.risk_factors.length > 0 ? (
              <div className="space-y-2">
                {risk.risk_factors.map((factor) => (
                  <div
                    key={factor}
                    className="flex items-center gap-3 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3"
                  >
                    <AlertTriangle
                      size={14}
                      className="shrink-0 text-warning"
                    />
                    <p className="text-sm text-slate-200">
                      {factor}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-success/25 bg-success/5 px-4 py-3">
                <CheckCircle2
                  size={14}
                  className="shrink-0 text-success"
                />
                <p className="text-sm text-slate-200">
                  No elevated risk factors for this account.
                </p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
                <p className="text-[10px] text-faint">
                  Suspicious (≥0.30)
                </p>
                <p className="mt-1 text-sm font-bold text-slate-200">
                  {safeNumber(risk.suspicious_transactions)} ·{" "}
                  {(risk.suspicious_rate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
                <p className="text-[10px] text-faint">
                  Avg Fraud Probability
                </p>
                <p className="mt-1 text-sm font-bold text-slate-200">
                  {formatProbability(
                    risk.average_fraud_probability
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-card-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Search size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-slate-100">
                Investigation Triage
              </h2>
            </div>
            {investigation ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-4 py-3">
                  <span className="text-xs text-faint">Status</span>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {investigation.investigation_status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
                    <p className="text-[10px] text-faint">
                      Suspicious Txns
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-200">
                      {safeNumber(
                        investigation.suspicious_transaction_count
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
                    <p className="text-[10px] text-faint">
                      Suspicious Amount
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-200">
                      {formatCurrency(
                        investigation.total_suspicious_amount
                      )}
                    </p>
                  </div>
                </div>
                {investigation.highest_risk_transaction && (
                  <div className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3">
                    <p className="text-[10px] text-faint">
                      Highest-risk transaction
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-200">
                      {
                        investigation.highest_risk_transaction
                          .transaction_id
                      }
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatProbability(
                        investigation.highest_risk_transaction
                          .fraud_probability
                      )}{" "}
                      ·{" "}
                      {formatCurrency(
                        investigation.highest_risk_transaction
                          .amount
                      )}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/network-analysis?account=${encodeURIComponent(
                          risk.account_id
                        )}`
                      )
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Network size={13} />
                    Network Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/investigation?account=${encodeURIComponent(
                          risk.account_id
                        )}`
                      )
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Search size={13} />
                    Investigation
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/transactions")}
                    className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <User size={13} />
                    All Transactions
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-faint">
                Investigation data unavailable for this account.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pb-2 text-xs text-slate-500">
          <span className="text-primary">Note:</span> Risk
          factors and shared-attribute links are investigation
          signals. They do not constitute proof of fraudulent
          activity.
        </div>
      </motion.div>
    </AppShell>
  );
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
    <div
      className={`rounded-xl border border-slate-600/50 ${bg} p-5`}
    >
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

export default AccountRisk;
