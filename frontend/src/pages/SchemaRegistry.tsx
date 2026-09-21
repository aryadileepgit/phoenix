import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  GitBranch,
  ArrowRightLeft,
  TrendingUp,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertTriangle,
  Loader2,
  Database,
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
  getSchemaRegistry,
  approveMapping,
  rejectMapping,
  mapWithGemini,
} from "../services/schemaService";
import { safeString, safeNumber } from "../utils/format";
import type { SchemaRegistryData, SchemaMapping } from "../types/schema";

const CONFIDENCE_COLORS = ["#22c55e", "#f97316", "#ef4444", "#facc15", "#2563eb"];
const METHOD_LABELS: Record<string, string> = { auto: "Auto", gemini: "Gemini", manual: "Manual", heuristic: "Heuristic" };

function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-bg">
        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${confidence * 100}%` }} />
      </div>
      <span className="text-faint text-xs font-mono">{(confidence * 100).toFixed(0)}%</span>
    </div>
  );
}

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-slate-300",
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  value: string | number;
  color?: string;
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

function ActionButton({
  icon: Icon,
  label,
  description,
  onClick,
  color = "text-primary",
  disabled = false,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 rounded-xl border border-card-border bg-bg/40 px-4 py-3 text-left transition-colors hover:border-primary/50 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Icon size={16} className={color} />
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-xs text-faint">{description}</p>
      </div>
    </button>
  );
}

export function SchemaRegistry({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<SchemaRegistryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mappingRunning, setMappingRunning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSchemaRegistry();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schema registry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (id: string) => {
    try {
      await approveMapping(id);
      setData((prev) =>
        prev ? { ...prev, mappings: prev.mappings.map((m) => (m.id === id ? { ...m, approved: true } : m)) } : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve mapping.");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectMapping(id);
      setData((prev) =>
        prev ? { ...prev, mappings: prev.mappings.map((m) => (m.id === id ? { ...m, approved: false } : m)) } : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject mapping.");
    }
  };

  const handleMapPendingWithGemini = async () => {
    if (!data) {
      return;
    }
    const pendingFields = data.mappings
      .filter((m) => !m.approved)
      .map((m) => m.incomingField);
    if (pendingFields.length === 0) {
      setNotice("No pending mappings — nothing to send to Gemini.");
      return;
    }
    setMappingRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await mapWithGemini(pendingFields);
      setNotice(result.message);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to run Gemini mapping."
      );
    } finally {
      setMappingRunning(false);
    }
  };

  if (loading) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Schema Evolution",
          description: "Monitor automated mapping of incoming transaction fields.",
          breadcrumb: "INTELLIGENCE / Schema Evolution",
          systemStatus: "online",
        }}
      >
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-64 rounded bg-slate-700" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} className="rounded-xl border border-slate-600/50 bg-card p-5 h-28" />
            ))}
          </div>
          <LoadingSkeleton className="rounded-xl border border-slate-600/50 bg-card p-5 h-80" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <LoadingSkeleton className="rounded-xl border border-slate-600/50 bg-card p-5 h-80 lg:col-span-2" />
            <LoadingSkeleton className="rounded-xl border border-slate-600/50 bg-card p-5 h-80" />
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
          title: "Schema Evolution",
          description: "Monitor automated mapping of incoming transaction fields.",
          breadcrumb: "INTELLIGENCE / Schema Evolution",
          systemStatus: "error",
        }}
      >
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error || "Failed to load schema registry"}
        </div>
      </AppShell>
    );
  }

  const {
    engineStatus,
    geminiConfigured,
    minConfidence,
    mappings,
    canonicalFields,
    version,
    stats: mappingStats,
  } = data;
  const avgConfidence =
    mappings.length > 0
      ? (
          (mappings.reduce((s, m) => s + m.confidence, 0) /
            mappings.length) *
          100
        ).toFixed(1)
      : "0";

  const pendingMappings = mappings.filter((m) => !m.approved);

  const confidenceDistribution = [
    "90–100%",
    "80–90%",
    "70–80%",
    "below 70%",
  ].map((range, i) => ({
    range,
    count: mappings.filter((m) => {
      const pct = m.confidence * 100;
      if (i === 0) {
        return pct >= 90;
      }
      if (i === 1) {
        return pct >= 80 && pct < 90;
      }
      if (i === 2) {
        return pct >= 70 && pct < 80;
      }
      return pct < 70;
    }).length,
  }));

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Schema Evolution",
        description: "Monitor automated mapping of incoming transaction fields.",
        breadcrumb: "INTELLIGENCE / Schema Evolution",
        systemStatus: engineStatus === "online" ? "online" : "error",
        systemStatusLabel: `Schema Engine ${
          engineStatus === "online" ? "Online" : "Offline"
        }`,
      }}
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
        {notice && (
          <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-xs font-medium text-success">
            {notice}
          </div>
        )}
        {/* Header Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={GitBranch} label="Canonical Fields" value={safeNumber(canonicalFields.length)} />
          <StatCard icon={ArrowRightLeft} label="Total Mappings" value={safeNumber(mappings.length)} />
          <StatCard icon={TrendingUp} label="Avg Confidence" value={avgConfidence + "%"} />
          <StatCard icon={BarChart3} label="Schema Version" value={version?.version ?? "-"} />
        </div>

        {/* Schema Engine Status */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${engineStatus === "online" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Schema Engine Status</h2>
              <p
                className="mt-0.5 text-sm"
                style={{
                  color: engineStatus === "online" ? "#22c55e" : "#ef4444",
                }}
              >
                {engineStatus === "online" ? "Online" : "Offline"}
                {" · Gemini "}
                {geminiConfigured ? "configured" : "not configured"}
                {" · min confidence "}
                {(minConfidence * 100).toFixed(0)}%
              </p>
            </div>
            <span className="ml-auto rounded-lg border border-card-border px-2.5 py-1 text-xs text-faint">
              {version?.status ?? "unknown"} · {version?.timestamp ? new Date(version.timestamp).toLocaleString() : "—"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">{version?.fields ?? 0} canonical fields defined</p>
        </motion.div>

        {/* Mapping Stats */}
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h2 className="text-sm font-semibold text-slate-100 mb-4">Mapping Statistics</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatItem icon={ArrowRightLeft} label="Total Mappings" value={mappingStats.total} color="#f97316" />
            <StatItem icon={Sparkles} label="Gemini Mappings" value={mappingStats.gemini} color="#2563eb" />
            <StatItem icon={Database} label="Registry Mappings" value={mappingStats.registry} color="#3b82f6" />
            <StatItem icon={Clock} label="Pending Review" value={mappingStats.pending} color="#facc15" />
          </div>
        </div>

        {/* Main Content */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Confidence Distribution */}
          <div className="rounded-2xl border border-card-border bg-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Confidence Distribution</h2>
              <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">Mapping Quality</span>
            </div>
            <div className="mt-4 h-56">
              {confidenceDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={confidenceDistribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#27344A" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="range" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #27344a", fontSize: 12 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {confidenceDistribution.map((_, i) => (
                        <Cell key={i} fill={CONFIDENCE_COLORS[i % CONFIDENCE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-56 items-center justify-center text-xs text-faint">No confidence data yet</div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">Quick Actions</h2>
            <div className="mt-4 space-y-3">
              <ActionButton
                icon={Sparkles}
                label={
                  mappingRunning
                    ? "Mapping with Gemini..."
                    : `Map pending with Gemini (${pendingMappings.length})`
                }
                description={
                  geminiConfigured
                    ? "Sends pending incoming fields for AI mapping"
                    : "GEMINI_API_KEY is not configured on the backend"
                }
                onClick={handleMapPendingWithGemini}
                color="text-primary"
                disabled={mappingRunning || pendingMappings.length === 0}
              />
              <p className="text-[11px] text-faint">
                New Gemini mappings at or above{" "}
                {(minConfidence * 100).toFixed(0)}% confidence are
                saved as Approved; lower-confidence results are
                skipped, never silently applied.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Mappings Table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Schema Mappings</h2>
            <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">{mappings.length} mappings</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead>
                <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                  <th className="px-3 py-2.5 font-medium">Incoming Field</th>
                  <th className="px-3 py-2.5 font-medium">Canonical Field</th>
                  <th className="px-3 py-2.5 font-medium">Confidence</th>
                  <th className="px-3 py-2.5 font-medium">Method</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className="border-b border-card-border/40 hover:bg-bg/40">
                    <td className="px-3 py-2.5 font-mono text-slate-300">{safeString(m.incomingField)}</td>
                    <td className="px-3 py-2.5 text-slate-300">{safeString(m.canonicalField)}</td>
                    <td className="px-3 py-2.5">
                      <ConfidenceBar confidence={m.confidence} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">{METHOD_LABELS[m.method] ?? m.method}</td>
                    <td className="px-3 py-2.5">
                      {m.approved ? (
                        <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={13} /> Approved</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning"><XCircle size={13} /> Pending</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-faint">{m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2.5">
                      {!m.approved && (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(m.id)} className="rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20">Approve</button>
                          <button onClick={() => handleReject(m.id)} className="rounded-md bg-danger/10 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/20">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Canonical Fields */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-2xl border border-card-border bg-card p-5">
          <h2 className="text-sm font-semibold text-slate-100">Canonical Transaction Schema</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {canonicalFields.map((f) => (
                <span key={f.name} title={f.description} className="rounded-lg border border-card-border bg-bg/40 px-3 py-1.5 text-xs">
                  <span className="font-medium text-slate-200">{f.name}</span>
                </span>
              ))}
            </div>
        </motion.div>

        {/* Unmapped Fields */}
        {pendingMappings.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-warning/25 bg-warning/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-warning" />
              <h2 className="text-sm font-semibold text-slate-100">Unmapped Fields Requiring Review</h2>
            </div>
            <div className="space-y-2">
              {pendingMappings.slice(0, 10).map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-warning/25 bg-bg/40 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-300">{m.incomingField}</span>
                    <span className="text-faint">→</span>
                    <span className="text-slate-300">{m.canonicalField}</span>
                    <ConfidenceBar confidence={m.confidence} />
                  </div>
                  <span className="rounded-full border border-warning/25 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                    {METHOD_LABELS[m.method] ?? m.method}
                  </span>
                </div>
              ))}
              {pendingMappings.length > 10 && (
                <p className="text-xs text-faint mt-2">... and {pendingMappings.length - 10} more</p>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AppShell>
  );
}

function StatItem({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-card-border/70 bg-bg/40 px-3 py-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1A` }}>
        <Icon size={14} className={color} />
      </div>
      <div>
        <p className="text-[10px] text-faint">{label}</p>
        <p className="text-sm font-bold text-slate-100">{safeNumber(value)}</p>
      </div>
    </div>
  );
}

export default SchemaRegistry;