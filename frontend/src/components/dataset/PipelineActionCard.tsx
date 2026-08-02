import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PipelineActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  buttonLabel: string;
  onRun: () => void;
  loading: boolean;
  completed: boolean;
  locked?: boolean;
  lockedMessage?: string;
  successMessage: string;
  children?: ReactNode;
}

/**
 * Shared chrome (icon, title, run button, locked/loading/success states) for
 * every pipeline stage card — Cleaning, Preprocessing, SMOTE, Feature
 * Engineering, Train/Test Split. Each stage supplies its own result content
 * as children so the visual identity stays consistent across the page.
 */
export function PipelineActionCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onRun,
  loading,
  completed,
  locked,
  lockedMessage,
  successMessage,
  children,
}: PipelineActionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-card-border bg-card p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            <p className="mt-0.5 max-w-md text-xs text-faint">{description}</p>
          </div>
        </div>

        <motion.button
          type="button"
          onClick={onRun}
          disabled={loading || locked}
          whileHover={{ scale: loading || locked ? 1 : 1.02 }}
          whileTap={{ scale: loading || locked ? 1 : 0.98 }}
          className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(249,115,22,0.3)] transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-card disabled:text-faint disabled:shadow-none"
        >
          {locked ? <Lock size={13} /> : loading ? <Loader2 size={13} className="animate-spin" /> : null}
          {locked ? "Locked" : loading ? "Processing…" : buttonLabel}
        </motion.button>
      </div>

      {locked && lockedMessage && <p className="mt-3 text-[11px] text-faint">{lockedMessage}</p>}

      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-2.5 text-xs font-medium text-success"
          >
            <CheckCircle2 size={15} />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {children && <div className="mt-4">{children}</div>}
    </motion.div>
  );
}
