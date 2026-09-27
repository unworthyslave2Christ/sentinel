"use client";

import { useState } from "react";
import { TaskStatus } from "@/components/task-status";

export default function TasksClient({ tasks }: { tasks: any[] }) {
  const [items, setItems] = useState(tasks);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Enhance Emergency Procedures for Visitors in Alignment with Organizational Plans");
  const [description, setDescription] = useState("Update the Visitor Guideline (NCS-OTH-001) to include clear, specific emergency procedures for visitors. Define roles, accountability, and coordination with organizational emergency plans, including evacuation routes, assembly points, and instructions for visitors during emergencies.");
  const [priority, setPriority] = useState("LOW");
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); });

  async function createCustom() {
    setBusy(true);
    const r = await fetch("/api/remediation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, description, priority, dueDate }) });
    if (r.ok) { const data = await r.json(); setItems([{ id: data.id, title, description, priority, dueDate, status: "OPEN", customDeadline: true }, ...items]); }
    else alert((await r.json()).error || "Could not create remediation task");
    setBusy(false);
  }

  return <div className="p-6 lg:p-10">
    <div className="text-sm font-semibold text-blue-600">Remediation</div><h1 className="mt-1 text-3xl font-semibold">Action queue</h1><p className="mt-2 text-slate-500">AI-generated remediation uses a 5–50 day interval. Human reviewers can also set a custom deadline.</p>
    <section className="mt-8 rounded-xl border bg-white p-6"><h2 className="font-semibold">Custom remediation deadline</h2><div className="mt-4 grid gap-3"><input value={title} onChange={e=>setTitle(e.target.value)} className="rounded border p-3"/><textarea value={description} onChange={e=>setDescription(e.target.value)} className="min-h-28 rounded border p-3"/><div className="grid gap-3 sm:grid-cols-2"><select value={priority} onChange={e=>setPriority(e.target.value)} className="rounded border p-3"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="rounded border p-3"/></div><button disabled={busy} onClick={createCustom} className="w-fit rounded bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? "Creating…" : "Create custom deadline"}</button></div></section>
    <div className="mt-8 overflow-hidden rounded-xl border bg-white divide-y">{!items.length&&<div className="p-6 text-sm text-slate-500">No remediation tasks yet.</div>}{items.map((d:any)=><div key={d.id} className="p-5"><div className="flex justify-between gap-4"><div><h2 className="font-semibold">{d.title}</h2><p className="mt-1 text-sm text-slate-600">{d.description}</p></div><TaskStatus taskId={d.id} initial={String(d.status || "OPEN")} /></div><div className="mt-3 text-xs text-slate-500">Priority: {d.priority} · {d.customDeadline ? `Custom deadline: ${d.dueDate ? new Date(d.dueDate).toLocaleDateString() : "—"}` : `Due in ${d.dueInDays} days`}</div></div>)}</div>
  </div>;
}
