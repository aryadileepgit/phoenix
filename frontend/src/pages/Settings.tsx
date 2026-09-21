import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BrainCog,
  GitBranch,
  Activity,
  Server,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import {
  getSettings,
  updateModelSettings,
  updateSchemaEvolutionSettings,
  updateDriftDetectionSettings,
} from "../services/settingsService";
import type { SettingsData } from "../types/settings";

function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${className}`} />;
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={20} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
  helpText,
}: {
  label: string;
  children: React.ReactNode;
  helpText?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-300">
        {label}
      </label>
      {children}
      {helpText && <p className="text-xs text-faint">{helpText}</p>}
    </div>
  );
}

function Input({
  type = "text",
  value,
  onChange,
  placeholder,
  disabled = false,
  step,
  min,
  max,
}: {
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  step?: string;
  min?: string | number;
  max?: string | number;
}) {
  return (
    <input
      type={type}
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      step={step}
      min={min}
      max={max}
      className={`w-full rounded-xl border border-card-border bg-bg/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-faint outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    />
  );
}

export function Settings({ onLogout }: { onLogout: () => void }) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await getSettings());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const save = async (
    key: string,
    fn: () => Promise<void>,
    okMessage: string
  ) => {
    setSaving(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(okMessage);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Settings",
          description: "Live Phoenix configuration with real effect.",
          breadcrumb: "SYSTEM / Settings",
          systemStatus: "online",
        }}
      >
        <div className="animate-pulse space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton
              key={i}
              className="h-44 rounded-2xl border border-slate-600/50 bg-card p-5"
            />
          ))}
        </div>
      </AppShell>
    );
  }

  if (error && !settings) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Settings",
          description: "Live Phoenix configuration with real effect.",
          breadcrumb: "SYSTEM / Settings",
          systemStatus: "error",
        }}
      >
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      </AppShell>
    );
  }

  if (!settings) {
    return (
      <AppShell
        onLogout={onLogout}
        topbar={{
          title: "Settings",
          description: "Live Phoenix configuration with real effect.",
          breadcrumb: "SYSTEM / Settings",
          systemStatus: "online",
        }}
      >
        <div className="rounded-lg border border-slate-600/50 bg-card p-6 text-center text-sm text-slate-400">
          No settings data available
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Settings",
        description: "Live Phoenix configuration with real effect.",
        breadcrumb: "SYSTEM / Settings",
        systemStatus: "online",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-8"
      >
        {notice && (
          <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 size={16} />
            {notice}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-600/50 bg-card p-6">
          <SectionHeader
            icon={BrainCog}
            title="Model Decision Thresholds"
            description="Read by the scorer on every prediction. Saved values take effect immediately."
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <FormField label="Model">
              <Input
                value={settings.model.modelVersion}
                onChange={() => {}}
                disabled
              />
            </FormField>
            <FormField
              label="Verification Threshold"
              helpText="Probability at or above which transactions require verification. Must stay below the fraud threshold."
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.model.verificationThreshold}
                onChange={(v) =>
                  setSettings((s) =>
                    s
                      ? {
                          ...s,
                          model: {
                            ...s.model,
                            verificationThreshold: parseFloat(v) || 0,
                          },
                        }
                      : s
                  )
                }
              />
            </FormField>
            <FormField
              label="Fraud (Block) Threshold"
              helpText="Probability at or above which transactions are blocked."
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.model.fraudThreshold}
                onChange={(v) =>
                  setSettings((s) =>
                    s
                      ? {
                          ...s,
                          model: {
                            ...s.model,
                            fraudThreshold: parseFloat(v) || 0,
                          },
                        }
                      : s
                  )
                }
              />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end border-t border-card-border pt-4">
            <button
              onClick={() =>
                save("model", () =>
                  updateModelSettings({
                    fraudThreshold: settings.model.fraudThreshold,
                    verificationThreshold:
                      settings.model.verificationThreshold,
                  }), "Model thresholds saved and now enforced by the scorer.")
              }
              disabled={saving !== null}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {saving === "model" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Changes
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-600/50 bg-card p-6">
          <SectionHeader
            icon={GitBranch}
            title="Schema Evolution"
            description="Minimum confidence enforced for Gemini mappings. API keys live only on the backend."
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              label="Gemini AI"
              helpText="Presence flag only — keys are never sent to the browser."
            >
              <Input
                value={
                  settings.schemaEvolution.geminiConfigured
                    ? "Configured on backend"
                    : "Not configured (registry fallback only)"
                }
                onChange={() => {}}
                disabled
              />
            </FormField>
            <FormField
              label="Minimum Confidence"
              helpText="Gemini mappings below this score are skipped, never silently applied."
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.schemaEvolution.minConfidence}
                onChange={(v) =>
                  setSettings((s) =>
                    s
                      ? {
                          ...s,
                          schemaEvolution: {
                            ...s.schemaEvolution,
                            minConfidence: parseFloat(v) || 0,
                          },
                        }
                      : s
                  )
                }
              />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end border-t border-card-border pt-4">
            <button
              onClick={() =>
                save("schema", () =>
                  updateSchemaEvolutionSettings({
                    minConfidence:
                      settings.schemaEvolution.minConfidence,
                  }), "Schema confidence threshold saved.")
              }
              disabled={saving !== null}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {saving === "schema" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Changes
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-600/50 bg-card p-6">
          <SectionHeader
            icon={Activity}
            title="Concept Drift Detection"
            description="KS and fraud-rate thresholds evaluated by drift runs."
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              label="KS Threshold"
              helpText="Kolmogorov-Smirnov statistic above which a feature drifts."
            >
              <Input
                type="number"
                step="0.001"
                min="0"
                max="1"
                value={settings.driftDetection.driftKsThreshold}
                onChange={(v) =>
                  setSettings((s) =>
                    s
                      ? {
                          ...s,
                          driftDetection: {
                            ...s.driftDetection,
                            driftKsThreshold: parseFloat(v) || 0,
                          },
                        }
                      : s
                  )
                }
              />
            </FormField>
            <FormField
              label="Fraud Rate Change Threshold"
              helpText="Absolute fraud-rate shift that counts toward drift."
            >
              <Input
                type="number"
                step="0.001"
                min="0"
                max="1"
                value={settings.driftDetection.driftFraudRateThreshold}
                onChange={(v) =>
                  setSettings((s) =>
                    s
                      ? {
                          ...s,
                          driftDetection: {
                            ...s.driftDetection,
                            driftFraudRateThreshold:
                              parseFloat(v) || 0,
                          },
                        }
                      : s
                  )
                }
              />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end border-t border-card-border pt-4">
            <button
              onClick={() =>
                save("drift", () =>
                  updateDriftDetectionSettings({
                    driftKsThreshold:
                      settings.driftDetection.driftKsThreshold,
                    driftFraudRateThreshold:
                      settings.driftDetection.driftFraudRateThreshold,
                  }), "Drift thresholds saved.")
              }
              disabled={saving !== null}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {saving === "drift" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Changes
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-600/50 bg-card p-6">
          <SectionHeader
            icon={Server}
            title="System Status"
            description="Live backend probes. Read-only."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatusCard label="API" value={settings.system.api_status} />
            <StatusCard
              label="Database"
              value={settings.system.database_status}
            />
            <StatusCard
              label="Model Artifact"
              value={settings.system.model_artifact}
            />
          </div>
          <div className="mt-4 flex justify-end border-t border-card-border pt-4">
            <button
              onClick={loadData}
              className="flex items-center gap-2 rounded-lg border border-card-border bg-card px-3 py-2 text-sm font-semibold text-slate-300 hover:border-primary/50 hover:text-primary"
            >
              <RefreshCw size={14} /> Refresh Status
            </button>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  const good =
    value === "online" ||
    value === "connected" ||
    value === "present";
  return (
    <div className="rounded-xl border border-card-border/70 bg-bg/40 p-4">
      <p className="text-[10px] text-faint">{label}</p>
      <p
        className={`mt-1 text-sm font-bold capitalize ${
          good ? "text-success" : "text-danger"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default Settings;
