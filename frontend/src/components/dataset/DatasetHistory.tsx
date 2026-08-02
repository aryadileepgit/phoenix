import { motion } from "framer-motion";
import { History, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { safeNumber, safeString } from "../../utils/format";
import type { DatasetHistoryItem } from "../../types/dataset";

interface DatasetHistoryProps {
  items: DatasetHistoryItem[];
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
}

export function DatasetHistory({ items, loading, error, onSelect }: DatasetHistoryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-card-border bg-card p-6"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <History size={15} className="text-primary" />
        Dataset History
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-xs text-faint">
          <Loader2 size={14} className="animate-spin" /> Loading history…
        </div>
      )}

      {!loading && error && <p className="mt-4 text-xs text-faint">Dataset history is unavailable right now.</p>}

      {!loading && !error && items.length === 0 && (
        <p className="mt-4 text-xs text-faint">No previous datasets yet. Uploaded datasets will appear here.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="scrollbar-thin mt-4 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left text-xs">
            <thead>
              <tr className="text-faint">
                <th className="whitespace-nowrap border-b border-card-border px-3 py-2 font-semibold">Dataset Name</th>
                <th className="whitespace-nowrap border-b border-card-border px-3 py-2 font-semibold">Upload Time</th>
                <th className="whitespace-nowrap border-b border-card-border px-3 py-2 font-semibold">Status</th>
                <th className="whitespace-nowrap border-b border-card-border px-3 py-2 font-semibold">Rows</th>
                <th className="whitespace-nowrap border-b border-card-border px-3 py-2 font-semibold">Validation</th>
                <th className="whitespace-nowrap border-b border-card-border px-3 py-2 font-semibold">Cleaning</th>
                <th className="whitespace-nowrap border-b border-card-border px-3 py-2 font-semibold">Current Stage</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className="cursor-pointer border-b border-card-border/60 text-slate-300 transition-colors hover:bg-primary/5"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-100">{safeString(item.datasetName)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{safeString(item.uploadTime)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{safeString(item.status)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{safeNumber(item.rows)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <StatusPill
                      ok={(item.validationStatus ?? "").toUpperCase() === "PASSED"}
                      label={safeString(item.validationStatus, "Unknown")}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <StatusPill
                      ok={["COMPLETED", "DONE"].includes((item.cleaningStatus ?? "").toUpperCase())}
                      label={safeString(item.cleaningStatus, "Unknown")}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{safeString(item.currentStage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        ok ? "border-success/25 bg-success/10 text-success" : "border-danger/25 bg-danger/10 text-danger"
      }`}
    >
      {ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {label}
    </span>
  );
}
