export type RetrievalChunk = { id: string; documentId: string; text: string; start: number; end: number; score?: number; source?: string };

export interface Retriever {
  name: string;
  retrieve(chunks: RetrievalChunk[], query: string, limit: number): Promise<RetrievalChunk[]>;
}

function terms(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2);
}

export class LexicalRetriever implements Retriever {
  name = "lexical-v1";
  async retrieve(chunks: RetrievalChunk[], query: string, limit: number) {
    const q = terms(query);
    return chunks.map((c) => {
      const text = c.text.toLowerCase();
      const unique = new Set(q);
      const matches = [...unique].filter((t) => text.includes(t)).length;
      const density = q.length ? matches / q.length : 0;
      return { ...c, score: matches + density, source: this.name };
    }).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
  }
}

export class HybridRetriever implements Retriever {
  name = "hybrid-v1";
  private lexical = new LexicalRetriever();
  async retrieve(chunks: RetrievalChunk[], query: string, limit: number) {
    // Deterministic fallback remains authoritative when no embedding service is configured.
    // A future embedding provider can implement Retriever without changing audit orchestration.
    return this.lexical.retrieve(chunks, query, limit);
  }
}

export function getRetriever(): Retriever {
  return new HybridRetriever();
}
