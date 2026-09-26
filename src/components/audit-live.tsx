
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Workspace = {
  audit: any;
  findings: any[];
  evidence: any[];
  analysisRuns: any[];
  events: any[];
};

export default function AuditLive({
  auditId,
  initialAudit,
  initialFindings,
  initialEvidence = [],
  initialRuns = [],
  initialEvents = [],
}: {
  organizationId: string;
  auditId: string;
  initialAudit: any;
  initialFindings: any[];
  initialEvidence?: any[];
  initialRuns?: any[];
  initialEvents?: any[];
}) {
  const [workspace, setWorkspace] = useState<Workspace>({
    audit: initialAudit,
    findings: initialFindings,
    evidence: initialEvidence,
    analysisRuns: initialRuns,
    events: initialEvents,
  });

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/audits/${auditId}/workspace`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) return;

      const data = await response.json();

      setWorkspace(data);
    } catch {
      // Polling failures should not crash the audit page.
    }
  }, [auditId]);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/audits/${auditId}/workspace`,
          {
            cache: "no-store",
          },
        );

        if (active && response.ok) {
          setWorkspace(await response.json());
        }
      } catch {
        // Ignore transient polling failures.
      }
    };

    refresh();

    const timer = window.setInterval(refresh, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [auditId]);

  const {
    audit: a,
    findings: f,
    evidence,
    analysisRuns: runs,
    events,
  } = workspace;

  const evidenceByFinding = useMemo(
    () =>
      new Map<string, any[]>(
        f.map((finding) => [
          finding.id,
          evidence.filter(
            (item) => item.findingId === finding.id,
          ),
        ]),
      ),
    [f, evidence],
  );

  const startAudit = async () => {
    try {
      setStarting(true);
      setStartError(null);

      if (!workspace.audit.documentId) {
        throw new Error(
          "This audit does not have a source document.",
        );
      }

      const response = await fetch("/api/audits/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auditId,
          documentId: workspace.audit.documentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to start audit",
        );
      }

      await load();
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : "Failed to start audit",
      );
    } finally {
      setStarting(false);
    }
  };

  const canStart =
    ["QUEUED", "READY", "DRAFT"].includes(a.status) &&
    !starting;

  return (
    <div className="p-6 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-blue-600">
            Compliance workforce · governed audit
          </div>

          <h1 className="mt-1 text-3xl font-semibold">
            {a.title}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {a.status} · {a.progress || 0}% · schema{" "}
            {a.schemaVersion || "legacy"}
          </p>
        </div>

        <div className="flex items-start gap-3">
          {canStart && (
            <button
              type="button"
              onClick={startAudit}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={starting}
            >
              {starting ? "Starting…" : "Start Audit"}
            </button>
          )}

          <div className="rounded-xl border bg-white p-5 text-right">
            <div className="text-xs text-slate-500">
              RISK SCORE
            </div>

            <div className="text-3xl font-bold">
              {a.riskScore ?? "—"}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {a.riskSeverity || "Pending"}
            </div>
          </div>
        </div>
      </div>

      {startError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {startError}
        </div>
      )}

      <div className="mt-5 h-2 rounded bg-slate-200">
        <div
          className="h-2 rounded bg-blue-600 transition-all"
          style={{
            width: `${Math.min(
              100,
              Math.max(0, Number(a.progress) || 0),
            )}%`,
          }}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Findings", f.length],
          ["Evidence records", evidence.length],
          ["AI runs", runs.length],
          [
            "Reviewable",
            f.filter((x) =>
              ["OPEN", "IN_REVIEW"].includes(x.status),
            ).length,
          ],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border bg-white p-4"
          >
            <div className="text-xs uppercase text-slate-500">
              {label}
            </div>

            <div className="mt-2 text-2xl font-semibold">
              {value}
            </div>
          </div>
        ))}
      </div>

      {a.summary && (
        <div className="mt-5 rounded-xl border bg-white p-5">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Executive summary
          </div>

          <p className="mt-2 leading-7 text-slate-700">
            {a.summary}
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <div className="font-semibold">Audit trace</div>

            <p className="mt-2 text-sm text-slate-500">
              Every finding is linked to its source evidence,
              controls, and analysis runs.
            </p>
          </div>

          {!f.length && (
            <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">
              {a.status === "QUEUED"
                ? "The audit is queued and waiting to begin."
                : a.status === "MAPPING"
                  ? "The workforce is mapping the source to applicable controls."
                  : a.status === "ANALYZING"
                    ? "The workforce is analyzing the source and generating findings."
                    : a.status === "REVIEW"
                      ? "The audit completed without any findings requiring review."
                      : "No findings have been generated yet."}
            </div>
          )}

          {f.map((x) => (
            <article
              className="rounded-xl border bg-white p-5"
              key={x.id}
            >
              <div className="flex justify-between gap-4">
                <div>
                  <h2 className="font-semibold">
                    {x.title}
                  </h2>

                  <div className="mt-1 text-xs text-slate-500">
                    {x.category} ·{" "}
                    {Math.round(
                      Number(x.confidence || 0) * 100,
                    )}
                    % confidence · {x.status}
                  </div>
                </div>

                <span className="rounded-full border px-2 py-1 text-xs font-semibold">
                  {x.severity}
                </span>
              </div>

              <p className="mt-4 leading-7 text-slate-700">
                {x.explanation}
              </p>

              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Authoritative source evidence
                </div>

                {(evidenceByFinding.get(x.id) || []).map(
                  (z: any) => (
                    <div className="mt-3" key={z.id}>
                      <blockquote className="border-l-2 pl-3 text-sm italic">
                        “{z.text}”
                      </blockquote>

                      <p className="mt-1 pl-3 text-xs text-slate-500">
                        {z.reason}
                        {z.section
                          ? ` · ${z.section}`
                          : ""}
                        {z.page
                          ? ` · page ${z.page}`
                          : ""}
                        {z.chunkId
                          ? ` · chunk ${z.chunkId}`
                          : ""}
                      </p>
                    </div>
                  ),
                )}
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <b>Controls</b>

                  <div className="mt-1 text-slate-500">
                    {(x.controlIds || []).join(", ") ||
                      "None mapped"}
                  </div>
                </div>

                <div>
                  <b>Analysis run</b>

                  <div className="mt-1 break-all text-slate-500">
                    {x.analysisRunId || "—"}
                  </div>
                </div>

                <div>
                  <b>Risk run</b>

                  <div className="mt-1 break-all text-slate-500">
                    {x.riskAnalysisRunId || "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm">
                <b>Human review action:</b>{" "}
                {x.recommendation}
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-4">
          <div className="divide-y rounded-xl border bg-white">
            <div className="p-5 font-semibold">
              Analysis runs
            </div>

            {!runs.length && (
              <div className="p-4 text-sm text-slate-500">
                No analysis runs yet.
              </div>
            )}

            {runs.map((x) => (
              <div className="p-4" key={x.id}>
                <div className="flex justify-between gap-2">
                  <span className="text-xs font-semibold text-blue-600">
                    {x.agent}
                  </span>

                  <span className="text-xs text-slate-500">
                    {x.status}
                  </span>
                </div>

                <div className="mt-1 break-all text-xs text-slate-500">
                  {x.model} · {x.modelVersion} ·{" "}
                  {x.promptVersion}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  run {x.id}
                </div>
              </div>
            ))}
          </div>

          <div className="divide-y rounded-xl border bg-white">
            <div className="p-5 font-semibold">
              Workforce activity
            </div>

            {!events.length && (
              <div className="p-4 text-sm text-slate-500">
                No workforce activity yet.
              </div>
            )}

            {events.map((x) => (
              <div className="p-4" key={x.id}>
                <div className="text-xs font-semibold text-blue-600">
                  {x.agent || x.type}
                </div>

                <div className="mt-1 text-sm">
                  {x.message}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}