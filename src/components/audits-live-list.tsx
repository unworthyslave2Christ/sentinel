"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuditsLiveList({ audits }: { audits: { id: string; title: string; status: string; findingCount: number; scheduleSessionNumber?: number }[] }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [router]);
  return <div className="mt-8 rounded-xl border bg-white divide-y">
    {audits.map((x) => <Link className="flex justify-between gap-4 p-5 hover:bg-slate-50" href={`/dashboard/audits/${x.id}`} key={x.id}>
      <span>{x.title}<span className="mt-1 block text-xs text-slate-400">{x.scheduleSessionNumber ? `Monitoring session ${x.scheduleSessionNumber}` : "Initial audit"}</span></span>
      <span className="shrink-0">{x.status} · {x.findingCount || 0}</span>
    </Link>)}
    {!audits.length && <div className="p-5 text-sm text-slate-500">No audits yet.</div>}
  </div>;
}
