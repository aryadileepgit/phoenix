import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, Loader2, CheckCircle2, XCircle, Rows3, Columns3, HardDrive, Clock } from "lucide-react";
import { StatTile } from "./StatTile";
import { safeNumber, safeTime } from "../../utils/format";
import type { DatasetInfo } from "../../types/dataset";

interface UploadCardProps {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onUpload: () => void;
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
  success: boolean;
  dataset: DatasetInfo | null;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function UploadCard({
  selectedFile,
  onFileSelect,
  onUpload,
  uploading,
  uploadProgress,
  error,
  success,
  dataset,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  const handleBrowseChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-card-border bg-card p-6"
    >
      <h2 className="text-sm font-semibold text-slate-100">Upload Dataset</h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 ${
          isDragging
            ? "border-primary bg-primary/5 shadow-[0_0_50px_rgba(249,115,22,0.25)]"
            : "border-card-border bg-bg/40"
        }`}
      >
        <motion.div
          animate={isDragging ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.6, repeat: isDragging ? Infinity : 0 }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        >
          <UploadCloud size={26} />
        </motion.div>

        <div>
          <p className="text-sm font-semibold text-slate-100">Drag &amp; Drop your dataset here</p>
          <p className="mt-1 text-xs text-faint">or select a file from your computer</p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-card-border bg-card px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-primary/50 hover:text-primary"
        >
          Browse File
        </button>
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleBrowseChange} />

        {selectedFile && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <span className="flex items-center gap-2 rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs text-slate-300">
              <FileText size={14} className="text-secondary" />
              {selectedFile.name}
            </span>
            <span className="rounded-full border border-secondary/25 bg-secondary/10 px-2.5 py-1 text-[10px] font-semibold text-secondary">
              CSV
            </span>
            <span className="text-[11px] text-faint">{formatBytes(selectedFile.size)}</span>
          </div>
        )}

        <p className="text-[11px] text-faint">CSV files only</p>
      </div>

      <motion.button
        type="button"
        onClick={onUpload}
        disabled={!selectedFile || uploading}
        whileHover={{ scale: !selectedFile || uploading ? 1 : 1.01 }}
        whileTap={{ scale: !selectedFile || uploading ? 1 : 0.98 }}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(249,115,22,0.35)] transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading && <Loader2 size={16} className="animate-spin" />}
        {uploading ? `Uploading… ${uploadProgress}%` : "Upload Dataset"}
      </motion.button>

      <AnimatePresence mode="wait">
        {uploading && (
          <motion.div
            key="progress"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg"
          >
            <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
          </motion.div>
        )}

        {!uploading && success && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm font-medium text-success"
          >
            <CheckCircle2 size={16} />
            Dataset Uploaded Successfully
          </motion.div>
        )}

        {!uploading && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            <XCircle size={16} />
            Upload Failed — {error}
          </motion.div>
        )}
      </AnimatePresence>

      {dataset && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Rows3} label="Rows" value={safeNumber(dataset.rows)} />
          <StatTile icon={Columns3} label="Columns" value={safeNumber(dataset.columns)} />
          <StatTile icon={HardDrive} label="File Size" value={formatBytes(dataset.fileSize ?? 0)} />
          <StatTile icon={Clock} label="Upload Time" value={safeTime(dataset.uploadTime)} />
        </div>
      )}
    </motion.div>
  );
}
