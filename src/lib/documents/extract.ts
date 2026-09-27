export async function extractText(buffer: Buffer, mime: string) {
  if (mime === "text/plain") return buffer.toString("utf8");

  throw new Error("Only TXT files are supported");
}
