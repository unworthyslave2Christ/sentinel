"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuditItem = {
  id: string;
  title: string;
  status: string;
  findingCount: number;
  scheduleSessionNumber?: number;
  scheduleFrequency?: string | null;
  scheduleRunAt?: string | null;
  trigger?: string | null;
};

export default function AuditsLiveList({ audits: initialAudits }: { audits: AuditItem[] }) {
  const [audits, setAudits] = useState(initialAudits);

  useEffect(() => {
    let disposed = false;

    const refresh = async () => {
      try {
        const response = await fetch("/api/audits", { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json();
        if (!disposed && Array.isArray(next)) setAudits(next);
      } catch {
        // Preserve the current list if a background refresh temporarily fails.
      }
    };

    const timer = window.setInterval(refresh, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  return <div className="mt-8 rounded-xl border bg-white divide-y">
    {audits.map((x) => <Link className="flex justify-between gap-4 p-5 hover:bg-slate-50" href={`/dashboard/audits/${x.id}`} key={x.id}>
      <span>
        {x.title}
        <span className="mt-1 block text-xs text-slate-400">
          {x.scheduleSessionNumber
            ? `Monitoring session ${x.scheduleSessionNumber}${x.scheduleFrequency ? ` · ${x.scheduleFrequency.replaceAll("_", " ").toLowerCase()}` : ""}`
            : "Initial audit"}
          {x.scheduleRunAt ? ` · queued ${new Date(x.scheduleRunAt).toLocaleString()}` : ""}
        </span>
      </span>
      <span className="shrink-0">{x.status} · {x.findingCount || 0}</span>
    </Link>)}
    {!audits.length && <div className="p-5 text-sm text-slate-500">No audits yet.</div>}
  </div>;
}
