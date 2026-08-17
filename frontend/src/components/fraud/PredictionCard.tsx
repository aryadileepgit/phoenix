import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ShieldCheck, XCircle, Loader2, Sparkles, Lock } from "lucide-react";
import { predictTransaction } from "../../services/fraudDetectionService";
import type { FraudPredictionInput, FraudPredictionResult, TransactionTypeInput } from "../../types/fraud";

interface PredictionCardProps {
  /** Dataset with a trained model to run predictions against, or null if none is available yet. */
  datasetId: string | null;
}

const TRANSACTION_TYPES: TransactionTypeInput[] = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"];

const FIELD_CLASS =
  "w-full rounded-xl border border-card-border bg-bg/60 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25";

const DEFAULT_FORM: FraudPredictionInput = {
  step: 1,
  type: "PAYMENT",
  amount: 0,
  oldbalanceOrg: 0,
  newbalanceOrig: 0,
  oldbalanceDest: 0,
  newbalanceDest: 0,
  isFlaggedFraud: 0,
};

export function PredictionCard({ datasetId }: PredictionCardProps) {
  const [form, setForm] = useState<FraudPredictionInput>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FraudPredictionResult | null>(null);

  const locked = !datasetId;

  const updateField = <K extends keyof FraudPredictionInput>(key: K, value: FraudPredictionInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!datasetId || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const prediction = await predictTransaction(datasetId, form);
      setResult(prediction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  const isFraud = result?.result?.toLowerCase() === "fraud";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-2xl border border-card-border bg-card p-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Run a Fraud Prediction</h2>
          <p className="mt-0.5 max-w-md text-xs text-faint">
            Enter a transaction's raw fields and run it through the trained XGBoost model.
          </p>
        </div>
      </div>

      {locked ? (
        <p className="mt-4 flex items-center gap-2 text-[11px] text-faint">
          <Lock size={13} /> No trained model is available yet. Train one from the Dataset Management page first.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Step">
            <input
              type="number"
              className={FIELD_CLASS}
              value={form.step}
              onChange={(e) => updateField("step", Number(e.target.value))}
              min={0}
              required
            />
          </Field>

          <Field label="Transaction Type">
            <select
              className={FIELD_CLASS}
              value={form.type}
              onChange={(e) => updateField("type", e.target.value as TransactionTypeInput)}
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Amount">
            <input
              type="number"
              className={FIELD_CLASS}
              value={form.amount}
              onChange={(e) => updateField("amount", Number(e.target.value))}
              min={0}
              step="0.01"
              required
            />
          </Field>

          <Field label="Sender Balance Before (oldbalanceOrg)">
            <input
              type="number"
              className={FIELD_CLASS}
              value={form.oldbalanceOrg}
              onChange={(e) => updateField("oldbalanceOrg", Number(e.target.value))}
              min={0}
              step="0.01"
              required
            />
          </Field>

          <Field label="Sender Balance After (newbalanceOrig)">
            <input
              type="number"
              className={FIELD_CLASS}
              value={form.newbalanceOrig}
              onChange={(e) => updateField("newbalanceOrig", Number(e.target.value))}
              min={0}
              step="0.01"
              required
            />
          </Field>

          <Field label="Receiver Balance Before (oldbalanceDest)">
            <input
              type="number"
              className={FIELD_CLASS}
              value={form.oldbalanceDest}
              onChange={(e) => updateField("oldbalanceDest", Number(e.target.value))}
              min={0}
              step="0.01"
              required
            />
          </Field>

          <Field label="Receiver Balance After (newbalanceDest)">
            <input
              type="number"
              className={FIELD_CLASS}
              value={form.newbalanceDest}
              onChange={(e) => updateField("newbalanceDest", Number(e.target.value))}
              min={0}
              step="0.01"
              required
            />
          </Field>

          <Field label="System-Flagged Fraud (isFlaggedFraud)">
            <select
              className={FIELD_CLASS}
              value={form.isFlaggedFraud}
              onChange={(e) => updateField("isFlaggedFraud", Number(e.target.value))}
            >
              <option value={0}>0 — Not flagged</option>
              <option value={1}>1 — Flagged</option>
            </select>
          </Field>

          <div className="sm:col-span-2">
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(249,115,22,0.35)] transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Running Prediction…" : "Run Prediction"}
            </motion.button>
          </div>
        </form>
      )}

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-xs font-medium text-danger"
          >
            <XCircle size={15} />
            {error}
          </motion.div>
        )}

        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-4 rounded-xl border p-4 ${
              isFraud ? "border-danger/25 bg-danger/10" : "border-success/25 bg-success/10"
            }`}
          >
            <div className="flex items-center gap-2">
              {isFraud ? (
                <ShieldAlert size={16} className="text-danger" />
              ) : (
                <ShieldCheck size={16} className="text-success" />
              )}
              <span className={`text-sm font-semibold ${isFraud ? "text-danger" : "text-success"}`}>
                {result.result}
              </span>
              <span className="ml-auto text-[11px] text-faint">Model: {result.model}</span>
            </div>

            <div className="mt-3 space-y-2.5">
              <ProbabilityRow label="Fraud Probability" value={result.fraud_probability} tone="danger" />
              <ProbabilityRow label="Legitimate Probability" value={result.legitimate_probability} tone="success" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-faint">{label}</span>
      {children}
    </label>
  );
}

function ProbabilityRow({ label, value, tone }: { label: string; value: number; tone: "danger" | "success" }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-faint">
        <span>{label}</span>
        <span className={tone === "danger" ? "text-danger" : "text-success"}>{pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-card">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
          className={`h-full rounded-full ${tone === "danger" ? "bg-danger" : "bg-success"}`}
        />
      </div>
    </div>
  );
}
