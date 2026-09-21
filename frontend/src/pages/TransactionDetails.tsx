import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Hash,
  Layers,
  Brain,
  Target,
  Zap,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  getTransactionDetail,
  explainTransaction,
} from "../services/transactionDetailService";
import { getAccountHistory } from "../services/accountsService";
import { getTrainedModel } from "../services/datasetOverviewService";
import { safeDate } from "../utils/format";
import type {
  TransactionRecord,
  ExplainFeature,
} from "../types/transaction";
import type { AccountHistoryItem } from "../types/accounts";

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

function formatCurrency(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercentage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
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

function FeatureRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-card-border/40 py-2 text-xs last:border-0">
      <span className="shrink-0 font-mono text-[11px] text-faint">
        {label}
      </span>
      <span className="truncate font-medium text-slate-100">{value}</span>
    </div>
  );
}

function FeatureGroup({
  title,
  icon: Icon,
  features,
  initiallyOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  features: Array<{ label: string; value: React.ReactNode }>;
  initiallyOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    <div className="rounded-xl border border-card-border/70 bg-bg/40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={14} className="text-faint" />
          <span className="text-sm font-semibold text-slate-200">
            {title}
          </span>
          <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {features.length}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={14} className="text-faint" />
        ) : (
          <ChevronDown size={14} className="text-faint" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 border-t border-card-border/40 px-4 pb-4"
          >
            {features.map((f) => (
              <FeatureRow key={f.label} label={f.label} value={f.value} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function TransactionDetails({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const transactionId = id ?? "";

  const [transaction, setTransaction] =
    useState<TransactionRecord | null>(null);
  const [explanations, setExplanations] = useState<ExplainFeature[]>(
    []
  );
  const [explainError, setExplainError] = useState<string | null>(null);
  const [accountTxns, setAccountTxns] = useState<
    AccountHistoryItem[] | null
  >(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) {
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setExplainError(null);
      try {
        const txn = await getTransactionDetail(transactionId);
        setTransaction(txn);

        const [explainResult, historyResult, modelResult] =
          await Promise.all([
            explainTransaction({
              transaction_id: txn.transaction_id,
              account_id: txn.account_id,
              amount: txn.amount,
              transaction_time: txn.transaction_time,
              product_code: txn.product_code,
              card_information: txn.card_information,
              device_information: txn.device_information,
              additional_data: txn.additional_data,
            }).catch((err) => {
              setExplainError(
                err instanceof Error
                  ? err.message
                  : "Failed to load SHAP explanation."
              );
              return null;
            }),
            getAccountHistory(txn.account_id).catch(() => null),
            getTrainedModel().catch(() => null),
          ]);

        setExplanations(explainResult?.top_explanations ?? []);
        setAccountTxns(
          historyResult
            ? historyResult.transactions.filter(
                (t) => t.transaction_id !== txn.transaction_id
              )
            : []
        );
        setModelName(modelResult?.model_name ?? null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load transaction details."
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [transactionId]);

  const topbar = {
    title: "Transaction Details",
    description: "Stored XGBoost scoring with SHAP explanation.",
    breadcrumb: "DATA / Transactions / Details",
    systemStatus: "online" as const,
  };

  if (!transactionId) {
    return (
      <AppShell onLogout={onLogout} topbar={topbar}>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          No transaction ID in the URL.
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell onLogout={onLogout} topbar={topbar}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-slate-700" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <LoadingSkeleton className="h-40 rounded-xl border border-slate-600/50 bg-card p-5 xl:col-span-2" />
            <LoadingSkeleton className="h-40 rounded-xl border border-slate-600/50 bg-card p-5" />
          </div>
          <LoadingSkeleton className="h-64 rounded-xl border border-slate-600/50 bg-card p-5" />
          <LoadingSkeleton className="h-64 rounded-xl border border-slate-600/50 bg-card p-5" />
        </div>
      </AppShell>
    );
  }

  if (error || !transaction) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{ ...topbar, systemStatus: "error" as const }}
      >
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error || "Transaction not found"}
        </div>
        <button
          type="button"
          onClick={() => navigate("/transactions")}
          className="mt-4 flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
        >
          <ArrowLeft size={13} />
          Back to Transactions
        </button>
      </AppShell>
    );
  }

  const txn = transaction;
  const isFraud = txn.predicted_label === true;

  const positiveFeatures = explanations
    .filter((f) => f.impact === "INCREASES_FRAUD_RISK")
    .slice(0, 10);
  const negativeFeatures = explanations
    .filter((f) => f.impact === "DECREASES_FRAUD_RISK")
    .slice(0, 10);

  const dictRows = (
    title: string,
    dict: Record<string, unknown> | null
  ) =>
    dict
      ? Object.entries(dict).map(([k, v]) => ({
          label: k,
          value: stringify(v),
        }))
      : [];

  const featureGroups = [
    {
      title: "Transaction",
      icon: ArrowRight,
      features: [
        { label: "transaction_id", value: txn.transaction_id },
        { label: "account_id", value: txn.account_id },
        { label: "amount", value: formatCurrency(txn.amount) },
        {
          label: "transaction_time",
          value: safeDate(txn.transaction_time),
        },
        { label: "product_code", value: txn.product_code ?? "—" },
        {
          label: "actual_label",
          value:
            txn.actual_label === null
              ? "—"
              : txn.actual_label
                ? "Fraud"
                : "Legitimate",
        },
      ],
    },
    {
      title: "Card Information",
      icon: CreditCard,
      features: dictRows("card", txn.card_information),
    },
    {
      title: "Device Information",
      icon: Layers,
      features: dictRows("device", txn.device_information),
    },
    {
      title: "Additional Data",
      icon: Target,
      features: dictRows("additional", txn.additional_data),
    },
  ].filter((g) => g.features.length > 0);

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
            <p className="flex items-center gap-1.5 text-[11px] text-faint">
              <Hash size={12} /> {txn.transaction_id}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-50">
              Transaction Details
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/transactions")}
              className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
            >
              <ArrowLeft size={13} />
              Back
            </button>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                isFraud
                  ? "border-danger/25 bg-danger/10 text-danger"
                  : "border-success/25 bg-success/10 text-success"
              }`}
            >
              {isFraud ? "FRAUD" : "LEGITIMATE"}
            </span>
          </div>
        </div>

        {/* Risk Summary Card */}
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <div className="flex flex-wrap items-center gap-4">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-2xl ${
                    isFraud
                      ? "bg-danger/5"
                      : "bg-success/5"
                  }`}
                >
                  {isFraud ? (
                    <ShieldAlert size={28} className="text-danger" />
                  ) : (
                    <ShieldCheck size={28} className="text-success" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted">
                    Stored XGBoost Prediction
                  </p>
                  <p
                    className={`text-3xl font-bold ${
                      isFraud ? "text-danger" : "text-success"
                    }`}
                  >
                    {isFraud ? "Fraud" : "Legitimate"}
                  </p>
                </div>
                <div className="ml-auto flex flex-col items-end gap-2">
                  <div className="rounded-xl border border-card-border bg-bg/40 p-3">
                    <p className="text-xs text-muted">
                      Fraud Probability
                    </p>
                    <p className="text-2xl font-bold text-slate-50">
                      {formatPercentage(txn.fraud_probability)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={txn.risk_level} />
                    <DecisionBadge decision={txn.decision} />
                  </div>
                </div>
              </div>

              {/* Probability bar with backend thresholds */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-faint">0%</span>
                  <span className="text-faint">30% verify</span>
                  <span className="text-faint">70% block</span>
                  <span className="text-faint">100%</span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(txn.fraud_probability ?? 0) * 100}%`,
                      backgroundColor:
                        (txn.fraud_probability ?? 0) > 0.7
                          ? "#ef4444"
                          : (txn.fraud_probability ?? 0) > 0.3
                            ? "#facc15"
                            : "#22c55e",
                    }}
                  />
                  <div className="absolute bottom-0 top-0 w-px bg-slate-500/70 left-[30%]" />
                  <div className="absolute bottom-0 top-0 w-px bg-slate-500/70 left-[70%]" />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-faint">
                  <span>Backend rule: ≥70% BLOCK</span>
                  <span>≥30% VERIFY, else APPROVE</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-card-border bg-bg/40 p-4">
                <p className="text-xs text-muted">Risk Level</p>
                <div className="mt-1">
                  <RiskBadge level={txn.risk_level} />
                </div>
              </div>
              <div className="rounded-xl border border-card-border bg-bg/40 p-4">
                <p className="text-xs text-muted">Model</p>
                <p className="mt-1 font-mono text-sm text-slate-300">
                  {modelName ?? "Phoenix XGBoost"}
                </p>
              </div>
              <div className="rounded-xl border border-card-border bg-bg/40 p-4">
                <p className="text-xs text-muted">Account</p>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/account-risk?account=${encodeURIComponent(
                        txn.account_id
                      )}`
                    )
                  }
                  className="mt-1 font-mono text-sm text-primary hover:underline"
                >
                  {txn.account_id}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SHAP Explanation */}
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Brain size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-slate-100">
              Fraud Explanation (SHAP, trained model)
            </h2>
          </div>

          {explainError && (
            <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-medium text-danger">
              {explainError}
            </div>
          )}

          {!explainError && explanations.length === 0 && (
            <div className="flex h-32 items-center justify-center text-xs text-faint">
              No SHAP attributions returned for this transaction.
            </div>
          )}

          {explanations.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-danger">
                  <AlertCircle size={12} /> Increases Fraud
                  Probability
                </h3>
                <div className="h-64">
                  {positiveFeatures.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={positiveFeatures}
                        layout="vertical"
                        margin={{
                          top: 5,
                          right: 20,
                          left: 120,
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
                          tick={{ fill: "#64748B", fontSize: 11 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="feature"
                          width={110}
                          tick={{ fill: "#64748B", fontSize: 10 }}
                          stroke="#27344A"
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #27344a",
                            fontSize: 12,
                          }}
                          formatter={(value: any, name: any) => [
                            value !== undefined
                              ? Number(value).toFixed(4)
                              : "—",
                            name,
                          ]}
                        />
                        <Bar dataKey="shap_value" radius={[0, 4, 4, 0]}>
                          {positiveFeatures.map((_, i) => (
                            <Cell
                              key={i}
                              fill={
                                i === 0 ? "#ef4444" : "#ef444480"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-64 items-center justify-center text-xs text-faint">
                      No positive contributions
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-success">
                  <CheckCircle size={12} /> Decreases Fraud
                  Probability
                </h3>
                <div className="h-64">
                  {negativeFeatures.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={negativeFeatures}
                        layout="vertical"
                        margin={{
                          top: 5,
                          right: 20,
                          left: 120,
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
                          tick={{ fill: "#64748B", fontSize: 11 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="feature"
                          width={110}
                          tick={{ fill: "#64748B", fontSize: 10 }}
                          stroke="#27344A"
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #27344a",
                            fontSize: 12,
                          }}
                          formatter={(value: any, name: any) => [
                            value !== undefined
                              ? Number(value).toFixed(4)
                              : "—",
                            name,
                          ]}
                        />
                        <Bar dataKey="shap_value" radius={[0, 4, 4, 0]}>
                          {negativeFeatures.map((_, i) => (
                            <Cell
                              key={i}
                              fill={
                                i === 0 ? "#22c55e" : "#22c55e80"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-64 items-center justify-center text-xs text-faint">
                      No negative contributions
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transaction Features */}
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-slate-100">
              Stored Transaction Fields
            </h2>
          </div>
          <p className="mt-1 text-xs text-faint">
            Raw stored JSONs, shown as-is. Encoded model inputs
            are never exposed as fake readable values.
          </p>
          <div className="mt-4 space-y-3">
            {featureGroups.map((group) => (
              <FeatureGroup
                key={group.title}
                title={group.title}
                icon={group.icon}
                features={group.features}
                initiallyOpen={group.title === "Transaction"}
              />
            ))}
          </div>
        </div>

        {/* Decision Information */}
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-slate-100">
              Decision Information
            </h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-4">
              <p className="text-[10px] text-faint">
                Fraud Probability (stored)
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-50">
                {formatPercentage(txn.fraud_probability)}
              </p>
            </div>
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-4">
              <p className="text-[10px] text-faint">Risk (stored)</p>
              <p className="mt-1">
                <RiskBadge level={txn.risk_level} />
              </p>
            </div>
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-4">
              <p className="text-[10px] text-faint">
                Decision (stored)
              </p>
              <p className="mt-1">
                <DecisionBadge decision={txn.decision} />
              </p>
            </div>
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-4">
              <p className="text-[10px] text-faint">Scored At</p>
              <p className="mt-1 text-sm font-bold text-slate-50">
                {safeDate(txn.created_at)}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs text-primary">
              <Info
                size={12}
                className="mr-1 inline-block align-middle"
              />
              Backend decision rule: probability ≥ 0.70 →
              BLOCK · ≥ 0.30 → VERIFY · else APPROVE. Values
              above are the stored outputs, not recomputed here.
            </p>
          </div>
        </div>

        {/* Account Context */}
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-slate-100">
                Account Context
              </h2>
            </div>
            <span className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400">
              {accountTxns ? accountTxns.length : 0} other
              transactions
            </span>
          </div>
          {!accountTxns || accountTxns.length === 0 ? (
            <p className="py-8 text-center text-xs text-faint">
              No other scored transactions for this account.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead>
                  <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-3 py-2.5 font-medium">
                      Transaction ID
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Time
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Fraud Probability
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Risk
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Decision
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accountTxns.slice(0, 10).map((ctx) => (
                    <tr
                      key={ctx.transaction_id}
                      onClick={() =>
                        navigate(
                          `/transactions/${encodeURIComponent(
                            ctx.transaction_id
                          )}`
                        )
                      }
                      className="cursor-pointer border-b border-card-border/40 last:border-0 hover:bg-bg/40"
                    >
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                        {ctx.transaction_id}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {formatCurrency(ctx.amount)}
                      </td>
                      <td className="px-3 py-2.5 text-faint">
                        {safeDate(ctx.transaction_time)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {formatPercentage(ctx.fraud_probability)}
                      </td>
                      <td className="px-3 py-2.5">
                        <RiskBadge level={ctx.risk_level} />
                      </td>
                      <td className="px-3 py-2.5">
                        <DecisionBadge decision={ctx.decision} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </AppShell>
  );
}

export default TransactionDetails;
