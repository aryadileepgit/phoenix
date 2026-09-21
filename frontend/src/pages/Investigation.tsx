import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShieldAlert,
  Search,
  User,
  Network,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import {
  getWatchlist,
  getAccountInvestigation,
  getAccountRisk,
} from "../services/investigationService";
import { safeNumber, formatNumber } from "../utils/format";
import type { WatchlistEntry } from "../types/investigation";
import type { AccountInvestigationResponse } from "../types/accounts";
import type { AccountRiskResponse } from "../types/accounts";

const RISK_COLORS: Record<string, string> = {
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

function RiskBadge({ level }: { level: string }) {
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

function TriageBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    HIGH_PRIORITY: "bg-danger/10 text-danger border-danger/25",
    REVIEW: "bg-warning/10 text-warning border-warning/25",
    NO_SUSPICIOUS_ACTIVITY:
      "bg-success/10 text-success border-success/25",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        styles[status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/25"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
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
          <p className="mt-1 text-2xl font-bold text-slate-50">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

export function Investigation({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusedAccount = searchParams.get("account") ?? "";

  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>(
    focusedAccount
  );
  const [detail, setDetail] =
    useState<AccountInvestigationResponse | null>(null);
  const [detailRisk, setDetailRisk] =
    useState<AccountRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWatchlist();
      setWatchlist(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].account_id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load investigation watchlist."
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    if (focusedAccount) {
      setSelectedId(focusedAccount);
    }
  }, [focusedAccount]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailRisk(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    Promise.all([
      getAccountInvestigation(selectedId),
      getAccountRisk(selectedId),
    ])
      .then(([inv, risk]) => {
        setDetail(inv);
        setDetailRisk(risk);
      })
      .catch((err) =>
        setDetailError(
          err instanceof Error
            ? err.message
            : "Failed to load case detail."
        )
      )
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const filtered = watchlist.filter((c) => {
    if (riskFilter !== "all" && c.risk_level !== riskFilter) {
      return false;
    }
    if (search) {
      return c.account_id
        .toLowerCase()
        .includes(search.toLowerCase());
    }
    return true;
  });

  const riskDist = ["LOW", "MEDIUM", "HIGH"].map((level) => ({
    level,
    count: watchlist.filter((a) => a.risk_level === level).length,
  }));

  const fraudTotal = watchlist.reduce(
    (s, c) => s + c.fraud_predictions,
    0
  );

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Investigation",
        description:
          "Triage suspicious accounts from scored transactions.",
        breadcrumb: "INVESTIGATION / Investigation",
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
            icon={User}
            label="Watchlist Accounts"
            value={safeNumber(watchlist.length)}
          />
          <StatCard
            icon={AlertTriangle}
            label="High Risk"
            value={safeNumber(
              watchlist.filter((a) => a.risk_level === "HIGH").length
            )}
            bg="bg-danger/10"
          />
          <StatCard
            icon={ShieldAlert}
            label="Fraud Predictions"
            value={safeNumber(fraudTotal)}
          />
          <StatCard
            icon={Network}
            label="With Shared Links"
            value="See Network"
          />
        </div>

        <p className="text-xs text-slate-500">
          Watchlist is derived live from the accounts
          aggregation (predicted fraud present or elevated
          max probability). Triage status comes from the
          account investigation endpoint — there is no
          separate case store.
        </p>

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
              onClick={loadWatchlist}
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-card-border bg-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Cases Requiring Attention
              </h2>
              <span className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400">
                {filtered.length} cases
              </span>
            </div>
            {loading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <LoadingSkeleton
                    key={i}
                    className="h-12 rounded-xl border border-card-border bg-card"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="mt-4 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-medium text-danger">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <Inbox size={22} className="text-faint" />
                <p className="text-xs text-faint">
                  No suspicious accounts right now. All scored
                  accounts are LOW risk with no fraud
                  predictions.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                      <th className="px-3 py-2.5 font-medium">
                        Account
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        Transactions
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        Fraud Predictions
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        Highest Probability
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        Risk
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        Triage Hint
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c.account_id}
                        onClick={() => setSelectedId(c.account_id)}
                        className={`cursor-pointer border-b border-card-border/40 transition-colors last:border-0 hover:bg-bg/40 ${
                          selectedId === c.account_id
                            ? "bg-primary/5"
                            : ""
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                          {c.account_id}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {formatNumber(c.transaction_count)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {formatNumber(c.fraud_predictions)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-300">
                          {c.highest_fraud_probability !== null
                            ? `${(c.highest_fraud_probability * 100).toFixed(2)}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <RiskBadge level={c.risk_level} />
                        </td>
                        <td
                          className="max-w-[220px] truncate px-3 py-2.5 text-slate-400"
                          title={c.triage_hint}
                        >
                          {c.triage_hint}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-card-border bg-card p-5">
              <h2 className="text-sm font-semibold text-slate-100">
                Risk Distribution
              </h2>
              <div className="mt-3 h-40">
                {riskDist.some((d) => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDist}
                        dataKey="count"
                        nameKey="level"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {riskDist.map((d) => (
                          <Cell
                            key={d.level}
                            fill={RISK_COLORS[d.level] ?? "#64748b"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#1e293b",
                          border: "1px solid #27344a",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-faint">
                    No watchlist data
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-card-border bg-card p-5">
              <h2 className="text-sm font-semibold text-slate-100">
                Case Detail
              </h2>
              {!selectedId ? (
                <p className="mt-2 text-xs text-faint">
                  Select a case from the table.
                </p>
              ) : detailLoading ? (
                <div className="mt-4 space-y-2">
                  <LoadingSkeleton className="h-10 rounded-xl" />
                  <LoadingSkeleton className="h-10 rounded-xl" />
                  <LoadingSkeleton className="h-10 rounded-xl" />
                </div>
              ) : detailError || !detail ? (
                <p className="mt-2 text-xs text-danger">
                  {detailError ?? "Case detail unavailable."}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-200">
                      {detail.account_id}
                    </span>
                    <TriageBadge
                      status={detail.investigation_status}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
                      <p className="text-[10px] text-faint">
                        Suspicious
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-200">
                        {safeNumber(
                          detail.suspicious_transaction_count
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-card-border/70 bg-bg/40 p-3">
                      <p className="text-[10px] text-faint">
                        Suspicious Amount
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-200">
                        {formatCurrency(
                          detail.total_suspicious_amount
                        )}
                      </p>
                    </div>
                  </div>
                  {detailRisk && detailRisk.risk_factors.length > 0 && (
                    <div className="space-y-1.5">
                      {detailRisk.risk_factors.map((f) => (
                        <p
                          key={f}
                          className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-1.5 text-[11px] text-slate-300"
                        >
                          {f}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/account-risk?account=${encodeURIComponent(
                            detail.account_id
                          )}`
                        )
                      }
                      className="rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      Account Risk
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/network-analysis?account=${encodeURIComponent(
                            detail.account_id
                          )}`
                        )
                      }
                      className="rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      Network
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pb-2 text-xs text-slate-500">
          <ArrowLeft size={13} className="text-faint" />
          Shared identifiers are investigation signals, not
          proof of fraud.
        </div>
      </motion.div>
    </AppShell>
  );
}

export default Investigation;
