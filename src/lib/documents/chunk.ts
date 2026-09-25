import type { RetrievalChunk } from "@/lib/retrieval";

export type DocumentChunk = RetrievalChunk;

export function chunkText(documentId: string, text: string, size = 3500, overlap = 500): DocumentChunk[] {
  const out: DocumentChunk[] = [];
  const step = Math.max(1, size - overlap);

  for (let start = 0, i = 0; start < text.length; start += step, i++) {
    const end = Math.min(text.length, start + size);
    out.push({
      id: `${documentId}-${i}`,
      documentId,
      text: text.slice(start, end),
      start,
      end,
    });
    if (end === text.length) break;
  }

  return out;
}

export async function retrieveChunks(chunks: DocumentChunk[], query: string, limit = 8) {
  const { getRetriever } = await import("@/lib/retrieval");
  return getRetriever().retrieve(chunks, query, limit);
}
