"use client";

import { useEffect, useState } from "react";

type Analytics = {
  documents: number;
  audits: number;
  findings: {
    total: number;
    open: number;
    inReview: number;
    accepted: number;
    dismissed: number;
    resolved: number;
    critical: number;
    high: number;
  };
  remediation: { total: number; open: number; done: number };
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((response) => response.json())
      .then(setData);
  }, []);

  if (!data) return <main className="p-8">Loading analytics...</main>;

  const cards = [
    ["Documents", data.documents],
    ["Audits", data.audits],
    ["Total findings", data.findings.total],
    ["Open findings", data.findings.open],
    ["Critical", data.findings.critical],
    ["High", data.findings.high],
    ["Open remediation", data.remediation.open],
    ["Completed remediation", data.remediation.done],
  ];

  return (
    <main className="space-y-6 p-8">
      <div>
        <p className="text-sm font-semibold text-blue-600">SENTINEL · GOVERNANCE</p>
        <h1 className="mt-1 text-3xl font-semibold">Compliance analytics</h1>
        <p className="mt-2 text-sm text-slate-500">
          Organization-wide posture derived from the governed audit record.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold">Finding lifecycle</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-5 text-sm">
          <div>Open: {data.findings.open}</div>
          <div>In review: {data.findings.inReview}</div>
          <div>Accepted: {data.findings.accepted}</div>
          <div>Dismissed: {data.findings.dismissed}</div>
          <div>Resolved: {data.findings.resolved}</div>
        </div>
      </section>

      <a
        href="/api/reports"
        className="inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
      >
        Export findings CSV
      </a>
    </main>
  );
}
