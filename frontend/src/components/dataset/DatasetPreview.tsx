import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Table2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import type { DatasetPreviewRow } from "../../types/dataset";

interface DatasetPreviewProps {
  rows: DatasetPreviewRow[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function DatasetPreview({ rows }: DatasetPreviewProps) {
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const columns = useMemo(() => (rows.length > 0 ? Object.keys(rows[0]) : []), [rows]);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) => columns.some((col) => String(row[col] ?? "").toLowerCase().includes(q)));
  }, [rows, columns, query]);

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [filteredRows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-6">
        <h2 className="text-sm font-semibold text-slate-100">Dataset Preview</h2>
        <p className="mt-4 text-sm text-faint">The dataset preview will appear here after upload.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-card-border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100">
          <Table2 size={15} className="text-primary" />
          Dataset Preview
          <span className="rounded-full border border-card-border bg-bg/60 px-2.5 py-0.5 text-[10px] font-medium text-faint">
            {columns.length} columns
          </span>
          <span className="rounded-full border border-secondary/25 bg-secondary/10 px-2.5 py-0.5 text-[10px] font-medium text-secondary">
            Showing first {rows.length} rows
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-card-border bg-bg/60 px-3 py-2 sm:w-64">
          <Search size={14} className="text-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search rows…"
            className="w-full bg-transparent text-xs text-slate-200 placeholder:text-faint outline-none"
          />
        </div>
      </div>

      <div className="scrollbar-thin mt-4 max-h-96 overflow-auto rounded-xl border border-card-border">
        <table className="w-full min-w-max border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-sidebar">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="cursor-pointer select-none whitespace-nowrap border-b border-card-border px-4 py-2.5 font-semibold text-slate-300 hover:text-primary"
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === col && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, i) => (
              <tr key={i} className={`transition-colors hover:bg-primary/5 ${i % 2 === 0 ? "bg-card" : "bg-bg/40"}`}>
                {columns.map((col) => (
                  <td key={col} className="whitespace-nowrap border-b border-card-border/60 px-4 py-2.5 text-slate-300">
                    {String(row[col] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-faint">
        <div className="flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-card-border bg-bg/60 px-2 py-1 text-xs text-slate-200 outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-card-border bg-bg/60 p-1.5 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-card-border bg-bg/60 p-1.5 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
