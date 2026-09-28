"use client";

import { frequencyLabel, type MonitorFrequency } from "@/lib/monitoring/schedule";
import { useCallback, useEffect, useState } from "react";

type DocumentItem = { id: string; name: string; monitoringStatus?: string };
type Schedule = { id: string; name: string; frequency: string; active: boolean; documentIds?: string[]; nextRunAt: string | null; lastRunAt: string | null };
type Alert = { id: string; title: string; severity: string; status: string; createdAt: string | null };
type Props = { documents: DocumentItem[]; schedules: Schedule[]; alerts: Alert[] };

const frequencies: { value: MonitorFrequency; label: string }[] = [
  { value: "EVERY_3_MINUTES", label: "Every 3 minutes" },
  { value: "EVERY_5_MINUTES", label: "Every 5 minutes" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

function normaliseSchedule(value: any): Schedule {
  return {
    id: String(value.id),
    name: String(value.name || "Monitoring schedule"),
    frequency: String(value.frequency || "WEEKLY"),
    active: Boolean(value.active),
    documentIds: Array.isArray(value.documentIds) ? value.documentIds.map(String) : [],
    nextRunAt: value.nextRunAt || null,
    lastRunAt: value.lastRunAt || null,
  };
}

export default function MonitoringClient({ documents: initialDocuments, schedules: initialSchedules, alerts }: Props) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [name, setName] = useState("Weekly compliance review");
  const [frequency, setFrequency] = useState<MonitorFrequency>("WEEKLY");
  const [selected, setSelected] = useState<string[]>(initialDocuments.slice(0, 1).map((x) => x.id));
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/monitoring/schedules", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const nextSchedules = Array.isArray(payload.schedules) ? payload.schedules.map(normaliseSchedule) : [];
      const nextDocuments = Array.isArray(payload.documents) ? payload.documents : [];
      setSchedules(nextSchedules);
      setDocuments(nextDocuments);
    } catch {
      // Keep the current UI state if a background refresh temporarily fails.
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function create() {
    setBusy(true);
    try {
      const r = await fetch("/api/monitoring/schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, frequency, documentIds: selected }),
      });
      const payload = await r.json();
      if (!r.ok) {
        alert(payload.error || "Could not create schedule");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, patch: Record<string, unknown>) {
    const r = await fetch(`/api/monitoring/schedules/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await r.json();
    if (!r.ok) {
      alert(payload.error || "Could not update schedule");
      return null;
    }
    return payload;
  }

  async function toggle(x: Schedule) {
    const payload = await update(x.id, { active: !x.active });
    if (!payload) return;
    await refresh();
  }

  async function reschedule(x: Schedule, nextFrequency: string) {
    if (nextFrequency === x.frequency) return;
    const payload = await update(x.id, { frequency: nextFrequency });
    if (!payload) return;
    await refresh();
  }

  async function remove(x: Schedule) {
    if (!window.confirm(`Remove the monitoring schedule “${x.name}”? This will stop future runs for its documents.`)) return;
    const r = await fetch(`/api/monitoring/schedules/${x.id}`, { method: "DELETE" });
    const payload = await r.json();
    if (!r.ok) {
      alert(payload.error || "Could not remove schedule");
      return;
    }
    setSchedules((current) => current.filter((schedule) => schedule.id !== x.id));
    await refresh();
  }

  return <div className="mt-8 space-y-8">
    <section className="rounded-xl border bg-white p-6">
      <h2 className="font-semibold">Create monitoring schedule</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border p-2" placeholder="Schedule name" />
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as MonitorFrequency)} className="rounded border p-2">
          {frequencies.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button disabled={!selected.length || busy} onClick={create} className="rounded bg-slate-950 px-4 py-2 text-white disabled:opacity-40">
          {busy ? "Creating…" : "Create schedule"}
        </button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {documents.map((d) => <label key={d.id} className="flex items-center justify-between gap-3 rounded border p-3 text-sm">
          <span className="flex items-center gap-2">
            <input type="checkbox" checked={selected.includes(d.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, d.id] : selected.filter((x) => x !== d.id))} />
            {d.name}
          </span>
          <span className={`text-[11px] font-semibold ${d.monitoringStatus === "MONITORING" ? "text-blue-600" : d.monitoringStatus === "PAUSED" ? "text-amber-600" : "text-slate-400"}`}>
            {d.monitoringStatus === "MONITORING" ? "MONITORING" : d.monitoringStatus === "PAUSED" ? "PAUSED" : "NOT MONITORED"}
          </span>
        </label>)}
      </div>
    </section>

    <section className="rounded-xl border bg-white divide-y">
      <div className="p-5 font-semibold">Schedules</div>
      {!schedules.length && <div className="p-5 text-sm text-slate-500">No monitoring schedules yet.</div>}
      {schedules.map((x) => <div key={x.id} className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-medium">{x.name}</div>
            <div className="mt-1 text-xs text-slate-500">{frequencyLabel(x.frequency as MonitorFrequency)} · next {x.nextRunAt ? new Date(x.nextRunAt).toLocaleString() : "—"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={x.frequency} onChange={(e) => reschedule(x, e.target.value)} className="rounded border px-3 py-2 text-sm" aria-label={`Frequency for ${x.name}`}>
              {frequencies.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button onClick={() => toggle(x)} className="rounded border px-3 py-2 text-sm">{x.active ? "Pause" : "Resume & Run"}</button>
            <button onClick={() => remove(x)} className="rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">Remove</button>
          </div>
        </div>
      </div>)}
    </section>

    <section className="rounded-xl border bg-white divide-y">
      <div className="p-5 font-semibold">Monitoring alerts</div>
      {!alerts.length && <div className="p-5 text-sm text-slate-500">No alerts yet.</div>}
      {alerts.map((a) => <div key={a.id} className="p-5"><div className="flex justify-between"><span className="font-medium">{a.title}</span><span className="text-xs font-semibold">{a.severity}</span></div><div className="mt-1 text-xs text-slate-500">{a.status} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}</div></div>)}
    </section>
  </div>;
}
