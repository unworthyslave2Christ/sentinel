// 1. Import it as a namespace module so Turbopack accepts it
import * as pdf from "pdf-parse";

export async function extractText(buffer: Buffer, mime: string) {
  if (mime === "text/plain") return buffer.toString("utf8");

  if (mime === "application/pdf") {
    // 2. Cast the namespace object to "any" or "unknown" to allow execution
    const parsePdf = (pdf as any).default || pdf;
    const result = await parsePdf(buffer);
    
    return result.text || "";
  }

  throw new Error("Only PDF and TXT files are supported");
}
