"use client";
import { useState } from "react";

export default function ReviewControls({ id, auditId, initial }: { id: string; auditId: string; initial: string }) {
  const [status, setStatus] = useState(initial);

  async function update(nextStatus: string) {
    const response = await fetch(`/api/findings/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus, auditId }),
    });
    if (response.ok) setStatus(nextStatus);
    else alert("Could not update finding");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => update("IN_REVIEW")} className="rounded border px-3 py-2 text-xs">Review</button>
      <button onClick={() => update("ACCEPTED")} className="rounded border px-3 py-2 text-xs">Accept</button>
      <button onClick={() => update("DISMISSED")} className="rounded border px-3 py-2 text-xs">Dismiss</button>
      <span className="rounded bg-slate-100 px-3 py-2 text-xs">{status}</span>
    </div>
  );
}
