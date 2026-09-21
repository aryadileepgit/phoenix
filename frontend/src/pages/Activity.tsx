import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ScrollText,
  Clock,
  Database,
  Rocket,
  AlertCircle,
  Search,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { getActivity } from "../services/activityService";
import type {
  ActivityEvent,
  ActivityEventType,
} from "../types/activity";

const TYPE_CONFIG: Record<
  ActivityEventType,
  {
    icon: React.ComponentType<{
      size?: number;
      strokeWidth?: number;
      className?: string;
    }>;
    color: string;
    label: string;
  }
> = {
  dataset_upload: {
    icon: Database,
    color: "text-primary bg-primary/10",
    label: "Dataset",
  },
  model_trained: {
    icon: Rocket,
    color: "text-success bg-success/10",
    label: "Model",
  },
  batch_analyzed: {
    icon: AlertCircle,
    color: "text-warning bg-warning/10",
    label: "Analysis",
  },
};

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
}

export function Activity({ onLogout }: { onLogout: () => void }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActivity(50);
      setEvents(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load activity."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = events.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) {
      return false;
    }
    if (search) {
      const term = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(term) ||
        (e.detail ?? "").toLowerCase().includes(term)
      );
    }
    return true;
  });

  const countBy = (type: ActivityEventType) =>
    events.filter((e) => e.type === type).length;

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Activity",
        description:
          "System events derived from datasets, models, and scored batches.",
        breadcrumb: "SYSTEM / Activity",
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
            icon={ScrollText}
            label="Total Events"
            value={formatNumber(events.length)}
          />
          <StatCard
            icon={Database}
            label="Dataset Uploads"
            value={formatNumber(countBy("dataset_upload"))}
          />
          <StatCard
            icon={Rocket}
            label="Model Runs"
            value={formatNumber(countBy("model_trained"))}
          />
          <StatCard
            icon={AlertCircle}
            label="Analysis Batches"
            value={formatNumber(countBy("batch_analyzed"))}
          />
        </div>

        <p className="text-xs text-slate-500">
          Derived from records that exist (dataset uploads,
          completed model runs, scored transaction batches).
          Phoenix does not fabricate audit events.
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
                placeholder="Search title or detail..."
                className="w-full rounded-xl border border-card-border bg-bg/60 py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder:text-faint outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-card-border bg-bg/60 px-4 py-2.5 text-xs text-slate-100 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
            >
              <option value="all">All Types</option>
              <option value="dataset_upload">Dataset</option>
              <option value="model_trained">Model</option>
              <option value="batch_analyzed">Analysis</option>
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

        <div className="rounded-2xl border border-card-border bg-card p-6">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <LoadingSkeleton
                  key={i}
                  className="h-16 rounded-xl border border-card-border bg-card"
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

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <ScrollText size={22} className="text-faint" />
              <p className="text-xs text-faint">
                No activity events found
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((event, i) => {
                const config =
                  TYPE_CONFIG[event.type] ?? TYPE_CONFIG.batch_analyzed;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={`${event.type}-${event.timestamp}-${i}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="flex items-start gap-4 rounded-xl border border-slate-600/50 bg-card p-4"
                  >
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${config.color}`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {event.title}
                        </p>
                        <span className="whitespace-nowrap rounded-full border border-card-border px-2 py-0.5 text-[10px] font-medium text-slate-400">
                          {config.label}
                        </span>
                      </div>
                      {event.detail && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {event.detail}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={12} />
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </motion.div>
                );
              })}
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
    <div className="rounded-xl border border-slate-600/50 bg-card p-5">
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

export default Activity;
