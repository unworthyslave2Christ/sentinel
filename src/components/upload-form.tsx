"use client";

import { useState } from "react";

export default function UploadForm() {
  const [f, setF] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [t, setT] = useState("CONTRACT");
  const [m, setM] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!f || !name.trim()) return;
    setBusy(true);
    setM("");

    try {
      const form = new FormData();
      form.append("file", f);
      form.append("name", name.trim());
      form.append("type", t);

      const r = await fetch("/api/documents", { method: "POST", body: form });
      const j = await r.json();
      setM(r.ok ? `Saved ${j.name}. ${j.chunkCount} text chunks created. Audit queued: ${j.auditId}` : j.error || "Upload failed");
      if (r.ok) {
        setF(null);
        setName("");
      }
    } catch {
      setM("Could not submit the document. Check the server log and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <label className="text-sm font-medium" htmlFor="document-name">Document name</label>
      <input
        id="document-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={180}
        placeholder="National Environmental Regulation 2026"
        className="mt-2 w-full rounded border p-2"
      />

      <label className="mt-5 block text-sm font-medium" htmlFor="document-type">Type</label>
      <select id="document-type" value={t} onChange={(e) => setT(e.target.value)} className="mt-2 w-full rounded border p-2">
        <option>CONTRACT</option>
        <option>POLICY</option>
        <option>REGULATION</option>
        <option>PROCEDURE</option>
        <option>OTHER</option>
      </select>

      <label className="mt-5 block text-sm font-medium" htmlFor="document-file">Source file</label>
      <input
        id="document-file"
        className="mt-2 w-full rounded border p-2"
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        onChange={(e) => setF(e.target.files?.[0] || null)}
      />
      <p className="mt-2 text-xs text-slate-500">PDF and TXT up to 10MB. The source file is not stored in Firebase Storage; readable text is extracted and saved as Firestore chunks.</p>

      <button disabled={!f || !name.trim() || busy} onClick={go} className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm text-white disabled:opacity-40">
        {busy ? "Processing document…" : "Save text and start audit"}
      </button>

      {m && <p role="status" className="mt-4 text-sm text-slate-600">{m}</p>}
    </div>
  );
}
