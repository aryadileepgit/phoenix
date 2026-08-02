import { motion } from "framer-motion";
import { ArrowRight, Rocket } from "lucide-react";

interface FooterSummaryProps {
  completionPct: number;
  datasetsProcessed: number;
  ready: boolean;
  onProceed: () => void;
}

export function FooterSummary({ completionPct, datasetsProcessed, ready, onProceed }: FooterSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-card-border bg-gradient-to-br from-card to-bg p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs text-faint">Pipeline Completion</p>
            <p className="mt-1 text-2xl font-bold text-slate-50">{completionPct}%</p>
            <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-bg">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ duration: 0.7 }}
                className="h-full rounded-full bg-primary"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-faint">Datasets Processed</p>
            <p className="mt-1 text-2xl font-bold text-slate-50">{datasetsProcessed}</p>
          </div>
          <div>
            <p className="text-xs text-faint">Current Dataset</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{ready ? "Ready" : "In Progress"}</p>
          </div>
          <div>
            <p className="text-xs text-faint">Next Step</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">Model Training</p>
          </div>
        </div>

        <motion.button
          type="button"
          onClick={onProceed}
          disabled={!ready}
          whileHover={{ scale: ready ? 1.02 : 1 }}
          whileTap={{ scale: ready ? 0.98 : 1 }}
          className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(249,115,22,0.35)] transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Rocket size={16} />
          Proceed to Model Training
          <ArrowRight size={16} />
        </motion.button>
      </div>
    </motion.div>
  );
}
