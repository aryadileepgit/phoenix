import { motion } from "framer-motion";
import { Check, Loader2, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type StageStatus = "completed" | "running" | "pending";

export interface Stage {
  key: string;
  label: string;
  icon: LucideIcon;
  status: StageStatus;
}

interface PipelineProgressProps {
  stages: Stage[];
}

function styles(status: StageStatus) {
  if (status === "completed")
    return { ring: "border-success bg-success/10 text-success", badge: "border-success/25 bg-success/10 text-success", text: "Completed" };
  if (status === "running")
    return { ring: "border-primary bg-primary/10 text-primary", badge: "border-primary/25 bg-primary/10 text-primary", text: "Running" };
  return { ring: "border-card-border bg-bg/40 text-faint", badge: "border-card-border bg-card text-faint", text: "Pending" };
}

/** Horizontal timeline showing every stage of the fraud-detection data pipeline. */
export function PipelineProgress({ stages }: PipelineProgressProps) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-6">
      <h2 className="text-sm font-semibold text-slate-100">🚀 Data Pipeline Progress</h2>
      <p className="mt-1 text-xs text-faint">Track every stage of the fraud detection data pipeline.</p>

      <div className="scrollbar-thin mt-6 flex items-start overflow-x-auto pb-2">
        {stages.map((stage, i) => {
          const s = styles(stage.status);
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="flex items-center">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex w-28 flex-shrink-0 flex-col items-center text-center"
              >
                <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border-2 ${s.ring}`}>
                  {stage.status === "running" ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : stage.status === "completed" ? (
                    <Check size={18} />
                  ) : (
                    <Icon size={18} />
                  )}
                  {stage.status === "running" && (
                    <span className="absolute inset-0 animate-ping rounded-2xl border-2 border-primary opacity-40" />
                  )}
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-200">{stage.label}</p>
                <span className={`mt-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.badge}`}>{s.text}</span>
              </motion.div>

              {i < stages.length - 1 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.06 + 0.15 }}
                  style={{ transformOrigin: "left" }}
                  className={`mx-1 mt-6 h-0.5 w-8 flex-shrink-0 ${
                    stage.status === "completed" ? "bg-success" : "bg-card-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
