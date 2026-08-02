import { motion } from "framer-motion";
import { Folder, ArrowRight } from "lucide-react";

const STAGES = [
  "Raw Dataset",
  "Processed Dataset",
  "Preprocessed Dataset",
  "Balanced Dataset",
  "Engineered Dataset",
  "Training Dataset",
];

interface StorageFlowProps {
  /** Index of the furthest stage reached so far (-1 = nothing uploaded yet). */
  activeIndex: number;
}

export function StorageFlow({ activeIndex }: StorageFlowProps) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-6">
      <h2 className="text-sm font-semibold text-slate-100">Storage Flow</h2>
      <p className="mt-1 text-xs text-faint">Where your dataset lives as it moves through the pipeline.</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {STAGES.map((stage, i) => (
          <div key={stage} className="flex items-center gap-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                i <= activeIndex ? "border-primary/30 bg-primary/10 text-primary" : "border-card-border bg-bg/40 text-faint"
              }`}
            >
              <Folder size={14} />
              {stage}
            </motion.div>
            {i < STAGES.length - 1 && <ArrowRight size={14} className="text-faint" />}
          </div>
        ))}
      </div>
    </div>
  );
}
