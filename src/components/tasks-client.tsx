"use client";

import { TaskStatus } from "@/components/task-status";

export default function TasksClient({ tasks }: { tasks: any[] }) {
  const items = tasks;

  return <div className="p-6 lg:p-10">
    <div className="text-sm font-semibold text-blue-600">Remediation</div>
    <h1 className="mt-1 text-3xl font-semibold">Action queue</h1>
    <p className="mt-2 text-slate-500">Review and track remediation actions generated from audit findings.</p>
    <div className="mt-8 overflow-hidden rounded-xl border bg-white divide-y">
      {!items.length && <div className="p-6 text-sm text-slate-500">No remediation tasks yet.</div>}
      {items.map((d: any) => <div key={d.id} className="p-5">
        <div className="flex justify-between gap-4">
          <div>
            <h2 className="font-semibold">{d.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{d.description}</p>
          </div>
          <TaskStatus taskId={d.id} initial={String(d.status || "OPEN")} />
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Priority: {d.priority} · {d.customDeadline ? `Custom deadline: ${d.dueDate ? new Date(d.dueDate).toLocaleDateString() : "—"}` : `Due in ${d.dueInDays} days`}
        </div>
      </div>)}
    </div>
  </div>;
}
