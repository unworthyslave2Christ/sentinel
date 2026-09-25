import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import UploadForm from "@/components/upload-form";

export default async function Documents() {
  const s = await getCurrentSession();
  if (!s?.user?.id) return null;
  const org = await ensureOrganization(s.user.id, s.user.email);
  const q = await getAdminDb().collection(`organizations/${org}/documents`).orderBy("createdAt", "desc").limit(30).get();

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-semibold">Documents</h1>
      <p className="mt-2 max-w-2xl text-slate-500">Upload a PDF or TXT source. Sentinel extracts readable text and stores it as Firestore chunks, so this MVP does not require Firebase Storage or the Blaze plan just for document ingestion.</p>

      <div className="mt-8 max-w-2xl"><UploadForm /></div>

      <div className="mt-8 rounded-xl border bg-white divide-y">
        <div className="p-5 font-semibold">Library</div>
        {q.empty && <div className="p-5 text-sm text-slate-500">No documents.</div>}
        {q.docs.map((x) => {
          const d = x.data();
          return (
            <div key={x.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">{d.name}</div>
                <div className="mt-1 text-xs text-slate-500">{d.originalFilename} · {d.type} · {Number(d.textLength || 0).toLocaleString()} chars · {Number(d.chunkCount || 0).toLocaleString()} chunks</div>
              </div>
              <span className="text-xs text-slate-500">{d.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
