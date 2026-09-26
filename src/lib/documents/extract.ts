// import pdf from "pdf-parse";

export async function extractText(buffer: Buffer, mime: string) {
  if (mime === "text/plain") return buffer.toString("utf8");
  // if (mime === "application/pdf") return (await pdf(buffer)).text;
  // throw new Error("Only PDF and TXT are enabled in this MVP");
  throw new Error("Only TXT is enabled in this MVP");
}
