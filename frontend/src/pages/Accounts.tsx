import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Loader2,
  AlertTriangle,
  Inbox,
  TrendingUp,
  ShieldAlert,
  User,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { getAccounts } from "../services/accountsService";
import type { AccountSummary, AccountRiskLevel } from "../types/accounts";

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

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
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

export function Accounts({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<
    AccountSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAccounts();
      setAccounts(data.accounts ?? []);
      setFilteredAccounts(data.accounts ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load accounts."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let filtered = accounts;
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter((a) =>
        a.account_id.toLowerCase().includes(term)
      );
    }
    if (riskFilter !== "all") {
      filtered = filtered.filter(
        (a) => a.risk_level === riskFilter
      );
    }
    setFilteredAccounts(filtered);
  }, [accounts, search, riskFilter]);

  const highRiskCount = accounts.filter(
    (a) => a.risk_level === "HIGH"
  ).length;
  const totalTransactions = accounts.reduce(
    (s, a) => s + a.transaction_count,
    0
  );
  const totalAmount = accounts.reduce(
    (s, a) => s + a.total_amount,
    0
  );

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Accounts",
        description:
          "Monitor accounts aggregated from scored API transactions.",
        breadcrumb: "DATA / Accounts",
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={User}
            label="Total Accounts"
            value={formatNumber(accounts.length)}
          />
          <StatCard
            icon={ShieldAlert}
            label="High Risk"
            value={formatNumber(highRiskCount)}
            bg="bg-danger/10"
          />
          <StatCard
            icon={TrendingUp}
            label="Total Transactions"
            value={formatNumber(totalTransactions)}
          />
          <StatCard
            icon={CreditCard}
            label="Total Volume"
            value={formatCurrency(totalAmount)}
          />
        </div>

        {/* Identifier honesty note */}
        <p className="text-xs text-slate-500">
          Accounts are API-supplied identifiers from scored
          transactions (for example simulator{" "}
          <span className="font-mono">ACC_*</span> IDs).
          IEEE-CIS itself has no native account column;
          Phoenix groups scored rows by{" "}
          <span className="font-mono">Transaction.account_id</span>{" "}
          and never invents bank customer accounts.
        </p>

        {/* Search & Filters */}
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
                placeholder="Search Account ID..."
                className="w-full rounded-xl border border-card-border bg-bg/60 py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder:text-faint outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </div>

            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="rounded-xl border border-card-border bg-bg/60 px-4 py-2.5 text-xs text-slate-100 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
            >
              <option value="all">All Risk Levels</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <LoadingSkeleton
                  key={i}
                  className="h-12 rounded-lg border border-card-border bg-card"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-danger">
                <AlertTriangle size={15} />
                {error}
              </div>
              <button
                type="button"
                onClick={loadData}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/10"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredAccounts.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Inbox size={22} className="text-faint" />
              <p className="text-xs text-faint">
                {accounts.length === 0
                  ? "No scored transactions yet — run the simulator against POST /transactions/score first."
                  : "No accounts match the current filters."}
              </p>
            </div>
          )}

          {!loading && !error && filteredAccounts.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-card-border/70">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead>
                  <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-3 py-2.5 font-medium">
                      Account ID
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Transactions
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Total Amount
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Fraud Predictions
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Highest Fraud Probability
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      Risk Level
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr
                      key={account.account_id}
                      onClick={() =>
                        navigate(
                          `/account-risk?account=${encodeURIComponent(
                            account.account_id
                          )}`
                        )
                      }
                      className="cursor-pointer border-b border-card-border/40 transition-colors last:border-0 hover:bg-bg/40"
                    >
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                        {account.account_id}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {formatNumber(account.transaction_count)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {formatCurrency(account.total_amount)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {formatNumber(account.fraud_predictions)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-bg">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${
                                  (account.highest_fraud_probability ??
                                    0) * 100
                                }%`,
                                backgroundColor:
                                  (account.highest_fraud_probability ??
                                    0) > 0.7
                                    ? "#ef4444"
                                    : (account.highest_fraud_probability ??
                                        0) > 0.3
                                      ? "#facc15"
                                      : "#22c55e",
                              }}
                            />
                          </div>
                          <span className="font-mono text-slate-300">
                            {formatProbability(
                              account.highest_fraud_probability
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <RiskBadge level={account.risk_level} />
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

function StatCard({
  icon: Icon,
  label,
  value,
  bg = "bg-card",
}: {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  label: string;
  value: string | number;
  bg?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-600/50 ${bg} p-5`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-50">
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

export default Accounts;
