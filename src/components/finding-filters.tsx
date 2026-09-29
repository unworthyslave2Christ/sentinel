"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ReviewControls from "@/components/review-controls";

type Row = {
  id: string;
  auditId: string;
  auditTitle: string;
  documentName: string;
  title: string;
  severity: string;
  status: string;
  category?: string;
  confidence?: number;
  scheduleSessionId?: string;
  scheduleSessionNumber?: number;
  createdAt?: string | null;
  scheduleRunAt?: string | null;
  trigger?: string;
};

export default function FindingFilters({ rows, review = false }: { rows: Row[]; review?: boolean }) {
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState("ALL");
  const [documentName, setDocumentName] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const documents = useMemo(
    () => Array.from(new Set(rows.map((x) => x.documentName).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase();
    return rows.filter((x) =>
      (!q || x.title.toLowerCase().includes(q)) &&
      (severity === "ALL" || x.severity === severity) &&
      (documentName === "ALL" || x.documentName === documentName) &&
      (status === "ALL" || x.status === status),
    );
  }, [rows, name, severity, documentName, status]);

  return (
    <>
      <div className="mt-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Filter by finding name…" className="rounded-lg border px-3 py-2 text-sm" />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="ALL">All risk severities</option><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
        </select>
        <select value={documentName} onChange={(e) => setDocumentName(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="ALL">All document names</option>{documents.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="ALL">All statuses</option>
          {review ? <><option>OPEN</option><option>IN_REVIEW</option></> : <><option>OPEN</option><option>IN_REVIEW</option><option>ACCEPTED</option><option>DISMISSED</option></>}
        </select>
      </div>

      <div className="mt-4 text-xs text-slate-500">Showing {filtered.length} of {rows.length} findings.</div>
      <div className="mt-2 overflow-hidden rounded-xl border bg-white">
        <div className="grid grid-cols-[1fr_120px_180px_120px] border-b p-4 text-xs font-semibold uppercase text-slate-500">
          <span>Finding</span><span>Severity</span><span>Audit / document</span><span>Status</span>
        </div>
        {!filtered.length && <div className="p-6 text-sm text-slate-500">No findings match the selected filters.</div>}
        {filtered.map((x) => review ? (
          <div key={`${x.auditId}-${x.id}`} className="border-b p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <Link href={`/dashboard/audits/${x.auditId}`} className="min-w-0 flex-1">
                <span className="font-medium">{x.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{x.severity} · {x.documentName} · {x.auditTitle}{x.scheduleSessionNumber ? ` · session ${x.scheduleSessionNumber}` : ""}{x.scheduleSessionNumber ? ` · ${x.trigger === "MONITORING_SCHEDULED" ? "scheduled" : "rescheduled"}${x.scheduleRunAt ? ` ${new Date(x.scheduleRunAt).toLocaleString()}` : ""}` : ""}</span>
              </Link>
              <ReviewControls id={x.id} auditId={x.auditId} initial={x.status} />
            </div>
          </div>
        ) : (
          <Link key={`${x.auditId}-${x.id}`} href={`/dashboard/audits/${x.auditId}`} className="grid grid-cols-[1fr_120px_180px_120px] gap-3 border-b p-4 text-sm hover:bg-slate-50">
            <span><span className="font-medium">{x.title}</span><span className="mt-1 block text-xs text-slate-500">{x.category || "Finding"} · {Math.round(Number(x.confidence || 0) * 100)}% confidence</span></span>
            <span><span className="rounded-full border px-2 py-1 text-xs font-semibold">{x.severity}</span></span>
            <span className="truncate text-slate-600">{x.documentName}<span className="block text-xs text-slate-400">{x.auditTitle}{x.scheduleSessionNumber ? ` · session ${x.scheduleSessionNumber}` : ""}{x.scheduleSessionNumber ? ` · ${x.trigger === "MONITORING_SCHEDULED" ? "scheduled" : "rescheduled"}${x.scheduleRunAt ? ` ${new Date(x.scheduleRunAt).toLocaleString()}` : ""}` : ""}</span></span>
            <span className="text-slate-600">{x.status}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
