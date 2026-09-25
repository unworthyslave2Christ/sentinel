"use client";
import { useEffect, useState } from "react";

export default function PoliciesClient() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [control, setControl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() { const r = await fetch("/api/policies", { cache: "no-store" }); if (r.ok) setPolicies(await r.json()); }
  useEffect(() => { void load(); }, []);
  async function create() {
    if (!name.trim() || !control.trim()) return;
    setBusy(true); setMessage("");
    const r = await fetch("/api/policies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, controls: [{ id: `CTRL-${Date.now()}`, title: name, requirement: control }] }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json(); setMessage(j.error || "Unable to save policy"); return; }
    setName(""); setDescription(""); setControl(""); setMessage("Control saved."); void load();
  }
  return <div className="p-6 lg:p-10"><div className="text-sm font-semibold text-blue-600">Organizational memory</div><h1 className="mt-1 text-3xl font-semibold">Policies & controls</h1><p className="mt-2 max-w-2xl text-slate-500">Give the workforce explicit organizational controls so analysis can compare evidence against your own requirements.</p><div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]"><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Add a control</h2><input value={name} onChange={e=>setName(e.target.value)} placeholder="Control name" className="mt-4 w-full rounded-lg border p-3"/><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Policy context (optional)" className="mt-3 min-h-24 w-full rounded-lg border p-3"/><textarea value={control} onChange={e=>setControl(e.target.value)} placeholder="Requirement the organization expects" className="mt-3 min-h-32 w-full rounded-lg border p-3"/><button disabled={busy||!name.trim()||!control.trim()} onClick={create} className="mt-3 rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-40">{busy?"Saving…":"Save control"}</button>{message&&<p className="mt-3 text-sm text-slate-600">{message}</p>}</div><div className="rounded-xl border bg-white divide-y"><div className="p-5 font-semibold">Saved controls</div>{!policies.length&&<div className="p-5 text-sm text-slate-500">No controls yet.</div>}{policies.map(p=><div key={p.id} className="p-5"><div className="font-medium">{p.name}</div><p className="mt-1 text-sm text-slate-500">{p.description}</p>{p.controls?.map((c:any)=><div key={c.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><div className="font-medium">{c.id} · {c.title}</div><div className="mt-1 text-slate-600">{c.requirement}</div></div>)}</div>)}</div></div></div>;
}
