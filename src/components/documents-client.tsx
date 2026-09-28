"use client";

import { useRouter } from "next/navigation";
import UploadForm from "@/components/upload-form";

type DocumentRow = {
  id: string;
  name: string;
  originalFilename: string;
  type: string;
  textLength: number;
  chunkCount: number;
  status: string;
  monitoringStatus: string;
  monitoringNextRunAt: string | null;
  monitoringLastRunAt: string | null;
};

export default function DocumentsClient({
  initialDocuments,
}: {
  initialDocuments: DocumentRow[];
}) {
  const router = useRouter();

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-semibold">Documents</h1>
      <p className="mt-2 max-w-2xl text-slate-500">
        Upload a TXT source. Sentinel extracts readable text and stores the extracted
        content as Firestore chunks, so the ingestion path does not require Firebase Storage
        for document persistence.
      </p>

      <div className="mt-8 max-w-2xl">
        <UploadForm
          onUploaded={() => {
            // Re-run the Server Component query immediately after a successful
            // upload so the new document appears without a manual page reload.
            router.refresh();
          }}
        />
      </div>

      <div className="mt-8 rounded-xl border bg-white divide-y">
        <div className="p-5 font-semibold">
          Library
          <span className="ml-2 text-xs font-normal text-slate-500">
            {initialDocuments.length} document
            {initialDocuments.length === 1 ? "" : "s"}
          </span>
        </div>

        {!initialDocuments.length && (
          <div className="p-5 text-sm text-slate-500">No documents.</div>
        )}

        {initialDocuments.map((d) => (
          <div
            key={d.id}
            className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="mt-1 text-xs text-slate-500">
                {d.originalFilename} · {d.type} ·{" "}
                {d.textLength.toLocaleString()} chars ·{" "}
                {d.chunkCount.toLocaleString()} chunks
              </div>
            </div>
            <div className="text-right">
              <span className={`text-xs font-semibold ${d.monitoringStatus === "MONITORING" ? "text-blue-600" : d.monitoringStatus === "PAUSED" ? "text-amber-600" : "text-slate-500"}`}>
                {d.monitoringStatus === "MONITORING" ? "MONITORING" : d.status}
              </span>
              {d.monitoringStatus === "MONITORING" && (
                <div className="mt-1 text-[11px] text-slate-400">
                  Next check: {d.monitoringNextRunAt ? new Date(d.monitoringNextRunAt).toLocaleString() : "queued"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
