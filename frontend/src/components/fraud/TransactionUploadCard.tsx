import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, Loader2, XCircle, Sparkles, Lock, X } from "lucide-react";
import { formatBytes } from "../dataset/UploadCard";

interface TransactionUploadCardProps {
  datasetId: string | null;
  onAnalyze: (file: File) => void;
  analyzing: boolean;
  uploadProgress: number;
  error: string | null;
}

export function TransactionUploadCard({
  datasetId,
  onAnalyze,
  analyzing,
  uploadProgress,
  error,
}: TransactionUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const locked = !datasetId;

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (locked || analyzing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleBrowseChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleAnalyze = () => {
    if (!selectedFile || analyzing || locked) return;
    onAnalyze(selectedFile);
  };

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
          <h2 className="text-sm font-semibold text-slate-100">Analyze Transaction File</h2>
          <p className="mt-0.5 max-w-md text-xs text-faint">
            Upload transaction data and let the trained XGBoost model analyze it automatically.
          </p>
        </div>
      </div>

      {locked ? (
        <p className="mt-4 flex items-center gap-2 text-[11px] text-faint">
          <Lock size={13} /> No trained model is available yet. Train one from the Dataset Management page first.
        </p>
      ) : (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!analyzing) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative mt-5 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300 ${
              isDragging
                ? "border-primary bg-primary/5 shadow-[0_0_50px_rgba(249,115,22,0.25)]"
                : "border-card-border bg-bg/40"
            }`}
          >
            <motion.div
              animate={isDragging ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.6, repeat: isDragging ? Infinity : 0 }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
              <UploadCloud size={22} />
            </motion.div>

            <div>
              <p className="text-sm font-semibold text-slate-100">Drag &amp; drop transaction file here</p>
              <p className="mt-1 text-xs text-faint">or</p>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={analyzing}
              className="rounded-lg border border-card-border bg-card px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Browse File
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleBrowseChange}
              disabled={analyzing}
            />

            {selectedFile && (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                <span className="flex items-center gap-2 rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs text-slate-300">
                  <FileText size={14} className="text-secondary" />
                  {selectedFile.name}
                </span>
                <span className="text-[11px] text-faint">{formatBytes(selectedFile.size)}</span>
                {!analyzing && (
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-card-border text-faint transition-colors hover:border-danger/50 hover:text-danger"
                    aria-label="Remove file"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            )}

            <p className="text-[11px] text-faint">Supported format: CSV</p>
          </div>

          <motion.button
            type="button"
            onClick={handleAnalyze}
            disabled={!selectedFile || analyzing}
            whileHover={{ scale: !selectedFile || analyzing ? 1 : 1.01 }}
            whileTap={{ scale: !selectedFile || analyzing ? 1 : 0.98 }}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(249,115,22,0.35)] transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {analyzing && <Loader2 size={16} className="animate-spin" />}
            {analyzing ? `Analyzing… ${uploadProgress}%` : "Analyze Transactions"}
          </motion.button>

          <AnimatePresence mode="wait">
            {analyzing && (
              <motion.div
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </motion.div>
            )}

            {!analyzing && error && (
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
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
