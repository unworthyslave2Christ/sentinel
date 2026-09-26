declare module "pdf-parse" {
  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    version: string;
    text: string;
  }

  interface PDFParseOptions {
    pagerender?: (
      pageData: unknown,
    ) => Promise<string> | string;
    max?: number;
    version?: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: PDFParseOptions,
  ): Promise<PDFParseResult>;

  export default pdfParse;
}