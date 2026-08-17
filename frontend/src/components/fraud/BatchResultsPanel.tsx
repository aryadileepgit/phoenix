import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ListChecks, ShieldAlert, ShieldCheck, Percent, ArrowRight } from "lucide-react";
import { StatTile } from "../dataset/StatTile";
import type { BatchPredictionResult } from "../../types/fraud";

interface BatchResultsPanelProps {
  result: BatchPredictionResult;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function riskLabel(probability: number): { label: string; className: string } {
  if (probability >= 0.75) return { label: "Critical", className: "text-danger" };
  if (probability >= 0.5) return { label: "High", className: "text-danger" };
  if (probability >= 0.2) return { label: "Medium", className: "text-primary" };
  return { label: "Low", className: "text-success" };
}

export function BatchResultsPanel({ result }: BatchResultsPanelProps) {
  const { summary, results } = result;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl border border-card-border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Analysis Results</h2>
          <p className="mt-0.5 text-xs text-faint">
            {result.dataset_name ? `Analyzed against "${result.dataset_name}"` : "Analysis complete"} using{" "}
            {result.model}.
          </p>
        </div>

        <Link
          to="/transactions"
          className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-primary/50 hover:text-primary"
        >
          View Transactions
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={ListChecks} label="Total Transactions" value={summary.total_transactions.toLocaleString()} />
        <StatTile icon={ShieldAlert} label="Fraudulent" value={summary.fraud_count.toLocaleString()} />
        <StatTile icon={ShieldCheck} label="Legitimate" value={summary.legitimate_count.toLocaleString()} />
        <StatTile icon={Percent} label="Fraud Rate" value={`${summary.fraud_rate}%`} />
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-card-border/70">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
              <th className="px-3 py-2.5 font-medium">Transaction ID</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Fraud Probability</th>
              <th className="px-3 py-2.5 font-medium">Prediction</th>
              <th className="px-3 py-2.5 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => {
              const isFraud = row.result?.toLowerCase() === "fraud";
              const risk = riskLabel(row.fraud_probability);
              return (
                <tr key={row.transaction_id} className="border-b border-card-border/40 last:border-0">
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                    {row.transaction_id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{row.type}</td>
                  <td className="px-3 py-2.5 text-slate-300">{formatCurrency(row.amount)}</td>
                  <td className="px-3 py-2.5 text-slate-300">{(row.fraud_probability * 100).toFixed(1)}%</td>
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
                  <td className={`px-3 py-2.5 font-semibold ${risk.className}`}>{risk.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
