import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { StatTile } from "../components/dataset/StatTile";
import { TransactionDetailDrawer } from "../components/transactions/TransactionDetailDrawer";
import { getTransactions, getTransactionById } from "../services/transactionService";
import { safeDate } from "../utils/format";
import type { PredictionFilter, TransactionRecord, TransactionSummary } from "../types/transaction";

interface TransactionsProps {
  onLogout: () => void;
}

const PREDICTION_TABS: { label: string; value: PredictionFilter }[] = [
  { label: "All", value: "all" },
  { label: "Fraud", value: "fraud" },
  { label: "Legitimate", value: "legitimate" },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function Transactions({ onLogout }: TransactionsProps) {
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prediction, setPrediction] = useState<PredictionFilter>("all");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTransactions({ prediction, search: search || undefined });
      setSummary(data.summary);
      setTransactions(data.transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [prediction, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedTransaction(null);
      return;
    }
    setDetailError(null);
    getTransactionById(selectedId)
      .then(setSelectedTransaction)
      .catch((err) => setDetailError(err instanceof Error ? err.message : "Failed to load transaction."));
  }, [selectedId]);

  return (
    <AppShell onLogout={onLogout}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-slate-50">Transactions</h1>
        <p className="mt-1 text-sm text-muted">
          Monitor transactions analyzed by the PHOENIX fraud detection pipeline.
        </p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={ListChecks}
          label="Total Analyzed"
          value={summary ? summary.total_transactions.toLocaleString() : "—"}
        />
        <StatTile
          icon={ShieldAlert}
          label="Fraud Detected"
          value={summary ? summary.fraud_count.toLocaleString() : "—"}
        />
        <StatTile
          icon={ShieldCheck}
          label="Legitimate"
          value={summary ? summary.legitimate_count.toLocaleString() : "—"}
        />
        <StatTile icon={Percent} label="Fraud Rate" value={summary ? `${summary.fraud_rate}%` : "—"} />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-card-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by type, sender, or receiver…"
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
                  prediction === tab.value ? "bg-primary text-white" : "text-faint hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-card-border bg-card p-6">
        {loading && (
          <div className="flex items-center gap-2 py-10 text-xs text-faint">
            <Loader2 size={14} className="animate-spin" /> Loading transactions…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-medium text-danger">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        {!loading && !error && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <Inbox size={22} className="text-faint" />
            <p className="text-xs text-faint">No transactions found</p>
          </div>
        )}

        {!loading && !error && transactions.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-card-border/70">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                  <th className="px-3 py-2.5 font-medium">Transaction ID</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Prediction</th>
                  <th className="px-3 py-2.5 font-medium">Fraud Probability</th>
                  <th className="px-3 py-2.5 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const isFraud = txn.predicted_label === true;
                  return (
                    <tr
                      key={txn.id}
                      onClick={() => setSelectedId(txn.id)}
                      className="cursor-pointer border-b border-card-border/40 transition-colors last:border-0 hover:bg-bg/40"
                    >
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">{txn.id.slice(0, 8)}</td>
                      <td className="px-3 py-2.5 text-slate-300">{txn.type}</td>
                      <td className="px-3 py-2.5 text-slate-300">{formatCurrency(txn.amount)}</td>
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
                      <td className="px-3 py-2.5 text-slate-300">
                        {txn.fraud_probability !== null ? `${(txn.fraud_probability * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-faint">{safeDate(txn.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TransactionDetailDrawer
        transaction={detailError ? null : selectedTransaction}
        onClose={() => setSelectedId(null)}
      />
    </AppShell>
  );
}

export default Transactions;
