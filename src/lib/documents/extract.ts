import pdf from "pdf-parse";

export async function extractText(buffer: Buffer, mime: string) {
  if (mime === "text/plain") return buffer.toString("utf8");

  if (mime === "application/pdf") {
    const result = await pdf(buffer);
    return result.text || "";
  }

  throw new Error("Only PDF and TXT files are supported");
}
