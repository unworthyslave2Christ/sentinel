"use client";
import { useState } from "react";

export function TaskStatus({ taskId, initial }: { taskId: string; initial: string }) {
  const [status, setStatus] = useState(initial); const [busy, setBusy] = useState(false);
  async function update(next: string) { setBusy(true); const r = await fetch("/api/remediation", { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({taskId,status:next}) }); if(r.ok) setStatus(next); setBusy(false); }
  return <select disabled={busy} value={status} onChange={e=>update(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold"><option>OPEN</option><option>IN_PROGRESS</option><option>BLOCKED</option><option>DONE</option></select>;
}
