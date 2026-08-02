import { motion } from "framer-motion";
import { Activity as ActivityIcon } from "lucide-react";

export interface ActivityEntry {
  time: string;
  label: string;
}

interface ActivityTimelineProps {
  entries: ActivityEntry[];
}

/** Real, session-local log of pipeline actions the user has actually completed. */
export function ActivityTimeline({ entries }: ActivityTimelineProps) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <ActivityIcon size={15} className="text-primary" />
        Activity Timeline
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-xs text-faint">Actions you take on this dataset will appear here in real time.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((e, i) => (
            <motion.li
              key={`${e.time}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-16 flex-shrink-0 font-mono text-faint">{e.time}</span>
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              <span className="text-slate-300">{e.label}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
