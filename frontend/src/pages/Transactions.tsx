import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  Percent,
  Search,
  RefreshCcw,
  Loader2,
  AlertTriangle,
  Inbox,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import {
  getTransactions,
  scoreTransaction,
} from "../services/transactionService";
import { safeDate } from "../utils/format";
import type {
  PredictionFilter,
  TransactionRecord,
  TransactionSummary,
  ScoreTransactionResult,
} from "../types/transaction";

const PREDICTION_TABS: { label: string; value: PredictionFilter }[] = [
  { label: "All", value: "all" },
  { label: "Fraud", value: "fraud" },
  { label: "Legitimate", value: "legitimate" },
];

const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"];
const DECISIONS = ["APPROVE", "VERIFY", "BLOCK"];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) {
    return <span className="text-faint">—</span>;
  }
  const colors: Record<string, string> = {
    LOW: "#22c55e",
    MEDIUM: "#facc15",
    HIGH: "#ef4444",
  };
  const color = colors[level] ?? "#64748b";
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
  const colors: Record<string, string> = {
    APPROVE: "#22c55e",
    VERIFY: "#facc15",
    BLOCK: "#ef4444",
  };
  const color = colors[decision] ?? "#64748b";
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

function ProbabilityBar({ probability }: { probability: number | null }) {
  if (probability === null) {
    return <span className="text-faint">—</span>;
  }
  const color =
    probability > 0.7
      ? "#ef4444"
      : probability > 0.3
        ? "#facc15"
        : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-bg">
        <div
          className="h-1.5 rounded-full"
          style={{
            width: `${probability * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="font-mono text-[11px] text-slate-300">
        {(probability * 100).toFixed(2)}%
      </span>
    </div>
  );
}

function StatTile({
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
    <div className="rounded-xl border border-slate-600/50 bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-50">{value}</p>
        </div>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${iconColor}1A`, color: iconColor }}
        >
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}

export function Transactions({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prediction, setPrediction] = useState<PredictionFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [probMin, setProbMin] = useState("");
  const [probMax, setProbMax] = useState("");

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTransactions({
        prediction,
        search: debouncedSearch || undefined,
        limit: 500,
      });
      setSummary(data.summary);
      setTransactions(data.transactions);
      setPage(1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load transactions."
      );
    } finally {
      setLoading(false);
    }
  }, [prediction, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  // Advanced filters apply client-side over the fetched page
  // (stored backend risk/decision values, never recomputed).
  const filteredTransactions = transactions.filter((txn) => {
    if (riskFilter !== "all" && txn.risk_level !== riskFilter) {
      return false;
    }
    if (decisionFilter !== "all" && txn.decision !== decisionFilter) {
      return false;
    }
    if (
      dateFrom &&
      new Date(txn.transaction_time) < new Date(dateFrom)
    ) {
      return false;
    }
    if (dateTo && new Date(txn.transaction_time) > new Date(dateTo)) {
      return false;
    }
    if (amountMin && txn.amount < parseFloat(amountMin)) {
      return false;
    }
    if (amountMax && txn.amount > parseFloat(amountMax)) {
      return false;
    }
    if (
      probMin &&
      (txn.fraud_probability ?? 0) < parseFloat(probMin) / 100
    ) {
      return false;
    }
    if (
      probMax &&
      (txn.fraud_probability ?? 1) > parseFloat(probMax) / 100
    ) {
      return false;
    }
    return true;
  });

  const paginatedTransactions = filteredTransactions.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Transactions",
        description:
          "Monitor incoming and historical scored transactions.",
        breadcrumb: "DATA / Transactions",
        systemStatus: "online",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            icon={ListChecks}
            label="Total Analyzed"
            value={
              summary ? formatNumber(summary.total_transactions) : "—"
            }
            iconColor="#3b82f6"
          />
          <StatTile
            icon={ShieldAlert}
            label="Fraud Detected"
            value={summary ? formatNumber(summary.fraud_count) : "—"}
            iconColor="#ef4444"
          />
          <StatTile
            icon={ShieldCheck}
            label="Legitimate"
            value={
              summary ? formatNumber(summary.legitimate_count) : "—"
            }
            iconColor="#22c55e"
          />
          <StatTile
            icon={Percent}
            label="Fraud Rate"
            value={summary ? `${summary.fraud_rate}%` : "—"}
            iconColor="#f97316"
          />
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-card-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[250px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Transaction ID / Account ID..."
                className="w-full rounded-xl border border-card-border bg-bg/60 py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder:text-faint outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </div>

            <div className="flex rounded-xl border border-card-border bg-bg/40 p-1">
              {PREDICTION_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setPrediction(tab.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    prediction === tab.value
                      ? "bg-primary text-white"
                      : "text-faint hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setShowAdvancedFilters(!showAdvancedFilters)
              }
              className={`flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary ${
                showAdvancedFilters ? "bg-primary/10 text-primary" : ""
              }`}
            >
              <Filter size={13} />
              Advanced
              {showAdvancedFilters ? (
                <ChevronUp size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
            </button>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCcw size={13} />
              )}
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setShowScoreDialog(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <Zap size={13} />
              Score Transaction
            </button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <FilterSelect
                label="Risk Level"
                value={riskFilter}
                onChange={setRiskFilter}
                options={["all", ...RISK_LEVELS]}
              />
              <FilterSelect
                label="Decision"
                value={decisionFilter}
                onChange={setDecisionFilter}
                options={["all", ...DECISIONS]}
              />
              <FilterInput
                label="Date From"
                type="date"
                value={dateFrom}
                onChange={setDateFrom}
              />
              <FilterInput
                label="Date To"
                type="date"
                value={dateTo}
                onChange={setDateTo}
              />
              <FilterInput
                label="Amount Min"
                type="number"
                value={amountMin}
                onChange={setAmountMin}
                placeholder="0"
              />
              <FilterInput
                label="Amount Max"
                type="number"
                value={amountMax}
                onChange={setAmountMax}
                placeholder="100000"
              />
              <FilterInput
                label="Prob Min %"
                type="number"
                value={probMin}
                onChange={setProbMin}
                placeholder="0"
                step="0.1"
              />
              <FilterInput
                label="Prob Max %"
                type="number"
                value={probMax}
                onChange={setProbMax}
                placeholder="100"
                step="0.1"
              />
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          {loading && (
            <div className="flex items-center gap-2 py-10 text-xs text-faint">
              <Loader2 size={14} className="animate-spin" /> Loading
              transactions…
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-medium text-danger">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          {!loading && !error && filteredTransactions.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Inbox size={22} className="text-faint" />
              <p className="text-xs text-faint">
                No transactions found
              </p>
            </div>
          )}

          {!loading && !error && filteredTransactions.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-xl border border-card-border/70">
                <table className="w-full min-w-[1000px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                      <th className="px-3 py-2.5 font-medium">
                        Transaction ID
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        Account
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        Amount
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        Timestamp
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
                      <th className="px-3 py-2.5 font-medium">
                        Predicted Label
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((txn) => {
                      const isFraud = txn.predicted_label === true;
                      return (
                        <tr
                          key={txn.id}
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
                            {safeDate(txn.transaction_time)}
                          </td>
                          <td className="px-3 py-2.5">
                            <ProbabilityBar
                              probability={txn.fraud_probability}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <RiskBadge level={txn.risk_level} />
                          </td>
                          <td className="px-3 py-2.5">
                            <DecisionBadge decision={txn.decision} />
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                isFraud
                                  ? "border-danger/25 bg-danger/10 text-danger"
                                  : "border-success/25 bg-success/10 text-success"
                              }`}
                            >
                              {isFraud ? "FRAUD" : "LEGITIMATE"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-faint">
                    Showing {(page - 1) * pageSize + 1} to{" "}
                    {Math.min(
                      page * pageSize,
                      filteredTransactions.length
                    )}{" "}
                    of {filteredTransactions.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-primary/50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 text-xs text-slate-300">
                      Page {page} / {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-primary/50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showScoreDialog && (
          <ScoreDialog
            onClose={() => setShowScoreDialog(false)}
            onScored={load}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function ScoreDialog({
  onClose,
  onScored,
}: {
  onClose: () => void;
  onScored: () => void;
}) {
  const [transactionId, setTransactionId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [productCode, setProductCode] = useState("");
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreTransactionResult | null>(
    null
  );

  const handleScore = async () => {
    setScoreError(null);
    setResult(null);
    const parsedAmount = parseFloat(amount);
    if (!transactionId.trim() || !accountId.trim()) {
      setScoreError("Transaction ID and Account ID are required.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setScoreError("Amount must be a positive number.");
      return;
    }
    setScoring(true);
    try {
      const scored = await scoreTransaction({
        transaction_id: transactionId.trim(),
        account_id: accountId.trim(),
        amount: parsedAmount,
        transaction_time: new Date().toISOString(),
        product_code: productCode.trim() || null,
      });
      setResult(scored);
      onScored();
    } catch (err) {
      setScoreError(
        err instanceof Error ? err.message : "Scoring failed."
      );
    } finally {
      setScoring(false);
    }
  };

  return (
    <>
      <motion.div
        key="score-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        key="score-dialog"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-50">
              Score Transaction
            </h2>
            <p className="mt-1 text-xs text-muted">
              Scored by the trained XGBoost model via POST
              /transactions/score and persisted.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-card-border text-faint transition-colors hover:border-primary/50 hover:text-primary"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <ScoreField
            label="Transaction ID"
            value={transactionId}
            onChange={setTransactionId}
            placeholder="e.g. SIM_TEST_001"
          />
          <ScoreField
            label="Account ID"
            value={accountId}
            onChange={setAccountId}
            placeholder="e.g. ACC_10001"
          />
          <ScoreField
            label="Amount (USD)"
            value={amount}
            onChange={setAmount}
            placeholder="e.g. 2500.00"
            type="number"
          />
          <ScoreField
            label="Product Code (optional)"
            value={productCode}
            onChange={setProductCode}
            placeholder="W, H, C, S, R"
          />
          {scoreError && (
            <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-medium text-danger">
              {scoreError}
            </div>
          )}
          {result && (
            <div className="rounded-xl border border-card-border/70 bg-bg/40 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-faint">Fraud Probability</span>
                <span className="font-mono font-bold text-slate-100">
                  {result.fraud_probability !== null
                    ? `${(result.fraud_probability * 100).toFixed(2)}%`
                    : "—"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-faint">Risk</span>
                <RiskBadge level={result.risk_level} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-faint">Decision</span>
                <DecisionBadge decision={result.decision} />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleScore}
            disabled={scoring}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {scoring ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ShieldAlert size={16} />
            )}
            {scoring ? "Scoring..." : "Score with Phoenix Model"}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function ScoreField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-card-border bg-bg/60 px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/25"
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium text-faint">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-card-border bg-bg/60 px-3 py-2 text-xs text-slate-100 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "all" ? "All" : opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  step,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium text-faint">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className="w-full rounded-xl border border-card-border bg-bg/60 px-3 py-2 text-xs text-slate-100 outline-none transition-colors placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/25"
      />
    </div>
  );
}

export default Transactions;
