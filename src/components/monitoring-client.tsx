"use client";

import { frequencyLabel, type MonitorFrequency } from "@/lib/monitoring/schedule";
import { useState } from "react";

type Props={documents:{id:string,name:string}[];schedules:{id:string,name:string,frequency:string,active:boolean,nextRunAt:string|null,lastRunAt:string|null}[];alerts:{id:string,title:string,severity:string,status:string,createdAt:string|null}[]};
const frequencies: { value: MonitorFrequency; label: string }[] = [
  { value: "EVERY_3_MINUTES", label: "Every 3 minutes" },
  { value: "EVERY_5_MINUTES", label: "Every 5 minutes" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];
export default function MonitoringClient({documents,schedules:initial,alerts}:Props){
 const [schedules,setSchedules]=useState(initial); const [name,setName]=useState("Weekly compliance review"); const [frequency,setFrequency]=useState<MonitorFrequency>("WEEKLY"); const [selected,setSelected]=useState<string[]>(documents.slice(0,1).map(x=>x.id)); const [busy,setBusy]=useState(false);
 async function create(){setBusy(true);const r=await fetch("/api/monitoring/schedules",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,frequency,documentIds:selected})});if(r.ok) location.reload();else alert((await r.json()).error);setBusy(false)}
 async function update(id:string,patch:Record<string,unknown>){const r=await fetch(`/api/monitoring/schedules/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(patch)});if(!r.ok){alert((await r.json()).error||"Could not update schedule");return false}return true}
 async function toggle(x:any){const active=!x.active;if(await update(x.id,{active})) setSchedules(schedules.map(s=>s.id===x.id?{...s,active}:s));}
 async function reschedule(x:any,nextFrequency:string){if(nextFrequency===x.frequency)return;if(await update(x.id,{frequency:nextFrequency})) setSchedules(schedules.map(s=>s.id===x.id?{...s,frequency:nextFrequency,nextRunAt:new Date(Date.now()+ (nextFrequency==='EVERY_3_MINUTES'?180000:nextFrequency==='EVERY_5_MINUTES'?300000:0)).toISOString()}:s));}
 return <div className="mt-8 space-y-8">
  <section className="rounded-xl border bg-white p-6"><h2 className="font-semibold">Create monitoring schedule</h2><div className="mt-4 grid gap-4 md:grid-cols-3"><input value={name} onChange={e=>setName(e.target.value)} className="rounded border p-2"/><select value={frequency} onChange={e=>setFrequency(e.target.value as MonitorFrequency)} className="rounded border p-2">{frequencies.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select><button disabled={!selected.length||busy} onClick={create} className="rounded bg-slate-950 px-4 py-2 text-white disabled:opacity-40">{busy?"Creating…":"Create schedule"}</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{documents.map(d=><label key={d.id} className="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" checked={selected.includes(d.id)} onChange={e=>setSelected(e.target.checked?[...selected,d.id]:selected.filter(x=>x!==d.id))}/>{d.name}</label>)}</div></section>
  <section className="rounded-xl border bg-white divide-y"><div className="p-5 font-semibold">Schedules</div>{!schedules.length&&<div className="p-5 text-sm text-slate-500">No monitoring schedules yet.</div>}{schedules.map(x=><div key={x.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="font-medium">{x.name}</div><div className="mt-1 text-xs text-slate-500">{frequencyLabel(x.frequency as MonitorFrequency)} · next {x.nextRunAt?new Date(x.nextRunAt).toLocaleString():"—"}</div></div><div className="flex flex-wrap gap-2"><select value={x.frequency} onChange={e=>reschedule(x,e.target.value)} className="rounded border px-3 py-2 text-sm">{frequencies.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select><button onClick={()=>toggle(x)} className="rounded border px-3 py-2 text-sm">{x.active?"Pause":"Resume & Run"}</button></div></div></div>)}</section>
  <section className="rounded-xl border bg-white divide-y"><div className="p-5 font-semibold">Monitoring alerts</div>{!alerts.length&&<div className="p-5 text-sm text-slate-500">No alerts yet.</div>}{alerts.map(a=><div key={a.id} className="p-5"><div className="flex justify-between"><span className="font-medium">{a.title}</span><span className="text-xs font-semibold">{a.severity}</span></div><div className="mt-1 text-xs text-slate-500">{a.status} · {a.createdAt?new Date(a.createdAt).toLocaleString():""}</div></div>)}</section>
 </div>
}
