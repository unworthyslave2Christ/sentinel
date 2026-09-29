import AutoRefresh from "@/components/auto-refresh";
import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import DocumentsClient from "@/components/documents-client";

export default async function Documents() {
  const s = await getCurrentSession();
  if (!s?.user?.id) return null;

  const org = await ensureOrganization(s.user.id, s.user.email);
  const q = await getAdminDb()
    .collection(`organizations/${org}/documents`)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const documents = q.docs.map((x) => {
    const d = x.data();
    return {
      id: x.id,
      name: String(d.name || ""),
      originalFilename: String(d.originalFilename || ""),
      type: String(d.type || "OTHER"),
      textLength: Number(d.textLength || 0),
      chunkCount: Number(d.chunkCount || 0),
      status: String(d.status || "UNKNOWN"),
      monitoringStatus: String(d.monitoringStatus || "INACTIVE"),
      monitoringNextRunAt: d.monitoringNextRunAt?.toDate?.()?.toISOString() ?? null,
      monitoringLastRunAt: d.monitoringLastRunAt?.toDate?.()?.toISOString() ?? null,
      monitoringSessionNumber: d.monitoringSessionNumber ? Number(d.monitoringSessionNumber) : null,
    };
  });

  return (
    <>
      <AutoRefresh intervalMs={5000} />
      <DocumentsClient initialDocuments={documents} />
    </>
  );
}
