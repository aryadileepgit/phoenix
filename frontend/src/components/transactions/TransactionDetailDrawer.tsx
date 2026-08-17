import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, ShieldCheck, ArrowRight, Hash, Layers } from "lucide-react";
import type { TransactionRecord } from "../../types/transaction";
import { safeDate } from "../../utils/format";

interface TransactionDetailDrawerProps {
  transaction: TransactionRecord | null;
  onClose: () => void;
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-card-border/40 py-2.5 text-xs last:border-0">
      <span className="text-faint">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

export function TransactionDetailDrawer({ transaction, onClose }: TransactionDetailDrawerProps) {
  const isFraud = transaction?.predicted_label === true;

  return (
    <AnimatePresence>
      {transaction && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-card-border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] text-faint">
                  <Hash size={12} /> {transaction.id.slice(0, 8)}
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-50">Transaction Details</h2>
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

            <div
              className={`mt-5 flex items-center gap-2 rounded-xl border p-4 ${
                isFraud ? "border-danger/25 bg-danger/10" : "border-success/25 bg-success/10"
              }`}
            >
              {isFraud ? (
                <ShieldAlert size={18} className="text-danger" />
              ) : (
                <ShieldCheck size={18} className="text-success" />
              )}
              <div>
                <p className={`text-sm font-semibold ${isFraud ? "text-danger" : "text-success"}`}>
                  {isFraud ? "Fraud" : "Legitimate"}
                </p>
                {transaction.fraud_probability !== null && (
                  <p className="text-[11px] text-faint">
                    Fraud probability: {(transaction.fraud_probability * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                <Layers size={12} /> Transaction
              </p>
              <Row label="Type" value={transaction.type} />
              <Row label="Amount" value={formatCurrency(transaction.amount)} />
              <Row label="Step" value={transaction.step} />
              <Row label="Timestamp" value={safeDate(transaction.created_at)} />
              {transaction.actual_label !== null && (
                <Row label="Ground Truth" value={transaction.actual_label ? "Fraud" : "Legitimate"} />
              )}
            </div>

            <div className="mt-5">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Sender</p>
              <Row label="Account" value={transaction.sender ?? "—"} />
              <Row label="Balance Before" value={formatCurrency(transaction.sender_balance_before)} />
              <Row label="Balance After" value={formatCurrency(transaction.sender_balance_after)} />
            </div>

            <div className="mt-5">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                <ArrowRight size={12} /> Receiver
              </p>
              <Row label="Account" value={transaction.receiver ?? "—"} />
              <Row label="Balance Before" value={formatCurrency(transaction.receiver_balance_before)} />
              <Row label="Balance After" value={formatCurrency(transaction.receiver_balance_after)} />
            </div>

            <div className="mt-5">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Source</p>
              <Row label="Dataset ID" value={<span className="font-mono">{transaction.dataset_id.slice(0, 8)}</span>} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
