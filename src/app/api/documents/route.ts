import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";
import { extractText } from "@/lib/documents/extract";
import { chunkText } from "@/lib/documents/chunk";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const TYPES = ["CONTRACT", "POLICY", "REGULATION", "PROCEDURE", "OTHER"] as const;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_NAME_LENGTH = 180;
const CHUNK_SIZE = 3500;
const CHUNK_OVERLAP = 0;
const MAX_CHUNKS_PER_BATCH = 450;

function normalizeText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function writeChunks(db: ReturnType<typeof getAdminDb>, path: string, chunks: ReturnType<typeof chunkText>) {
  for (let i = 0; i < chunks.length; i += MAX_CHUNKS_PER_BATCH) {
    const batch = db.batch();
    const part = chunks.slice(i, i + MAX_CHUNKS_PER_BATCH);

    for (const chunk of part) {
      const ref = db.doc(`${path}/${chunk.id}`);
      batch.set(ref, {
        documentId: chunk.documentId,
        order: Number(chunk.id.split("-").pop() || 0),
        text: chunk.text,
        start: chunk.start,
        end: chunk.end,
        charCount: chunk.text.length,
        createdAt: new Date(),
      });
    }

    await batch.commit();
  }
}

export async function POST(req: Request) {
  let member;
  try {
    member = await requirePermission("UPLOAD_DOCUMENT");
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHENTICATED";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" },
      { status: message === "FORBIDDEN" ? 403 : 401 },
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const name = String(form.get("name") || "").trim();
    const type = String(form.get("type") || "OTHER");

    if (!(file instanceof File)) return NextResponse.json({ error: "File required" }, { status: 400 });
    if (!TYPES.includes(type as (typeof TYPES)[number])) return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    if (!file.name || file.name.length > MAX_NAME_LENGTH) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    if (!name || name.length > MAX_NAME_LENGTH) return NextResponse.json({ error: "Document name is required and must be 180 characters or fewer" }, { status: 400 });
    if (!["application/pdf", "text/plain"].includes(file.type)) return NextResponse.json({ error: "MVP supports PDF and TXT" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Maximum 10MB" }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const text = normalizeText(await extractText(bytes, file.type));
    if (!text) return NextResponse.json({ error: "No readable text was found in the document" }, { status: 422 });

    const contentHash = createHash("sha256").update(text, "utf8").digest("hex");
    const org = member.organizationId;
    const db = getAdminDb();
    const doc = db.collection(`organizations/${org}/documents`).doc();
    const audit = db.collection(`organizations/${org}/audits`).doc();
    const chunks = chunkText(doc.id, text, CHUNK_SIZE, CHUNK_OVERLAP);
    const now = new Date();

    await doc.set({
      name,
      originalFilename: file.name,
      type,
      mimeType: file.type,
      size: file.size,
      contentHash,
      contentStorage: "FIRESTORE_CHUNKS",
      textLength: text.length,
      chunkCount: chunks.length,
      textPreview: text.slice(0, 800),
      changeStatus: "BASELINE",
      status: "READY",
      createdBy: member.userId,
      createdAt: now,
      updatedAt: now,
      lastIngestedAt: now,
      schemaVersion: "v5.1",
    });

    await writeChunks(db, `organizations/${org}/documents/${doc.id}/chunks`, chunks);

    await audit.set({
      title: `${name} — Initial audit`,
      documentId: doc.id,
      documentIds: [doc.id],
      status: "QUEUED",
      progress: 0,
      riskScore: null,
      findingCount: 0,
      createdBy: member.userId,
      createdAt: now,
      updatedAt: now,
      trigger: "MANUAL_UPLOAD",
      schemaVersion: "v5.1",
    });

    await db.collection(`organizations/${org}/audits/${audit.id}/events`).add({
      type: "STATUS",
      agent: "Ingestion Agent",
      message: `Stored ${text.length.toLocaleString()} extracted characters in ${chunks.length.toLocaleString()} Firestore chunk(s).`,
      createdAt: now,
    });

    await inngest.send({
      name: "sentinel/audit.requested",
      data: { organizationId: org, auditId: audit.id, documentId: doc.id, documentIds: [doc.id] },
    });

    await logSecurityEvent(member, "DOCUMENT_UPLOADED", {
      documentId: doc.id,
      auditId: audit.id,
      name,
      originalFilename: file.name,
      size: file.size,
      textLength: text.length,
      chunkCount: chunks.length,
    });

    return NextResponse.json({ documentId: doc.id, auditId: audit.id, name, textLength: text.length, chunkCount: chunks.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
