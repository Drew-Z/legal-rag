import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export interface ParsedDocument {
  text: string;
  parser: "txt" | "pdf" | "docx";
  warnings: string[];
}

export interface DocumentParser {
  supports(filename: string, mimeType?: string): boolean;
  parse(buffer: Buffer, filename: string, mimeType?: string): Promise<ParsedDocument>;
}

export class TxtParser implements DocumentParser {
  supports(filename: string, mimeType?: string): boolean {
    return /\.txt$/i.test(filename) || mimeType?.startsWith("text/") === true;
  }

  async parse(buffer: Buffer): Promise<ParsedDocument> {
    return {
      text: buffer.toString("utf8"),
      parser: "txt",
      warnings: []
    };
  }
}

export class DocxParser implements DocumentParser {
  supports(filename: string, mimeType?: string): boolean {
    return /\.docx$/i.test(filename) || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      parser: "docx",
      warnings: result.messages.map((message) => message.message)
    };
  }
}

export class PdfParser implements DocumentParser {
  supports(filename: string, mimeType?: string): boolean {
    return /\.pdf$/i.test(filename) || mimeType === "application/pdf";
  }

  async parse(buffer: Buffer): Promise<ParsedDocument> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return {
        text: result.text,
        parser: "pdf",
        warnings: []
      };
    } finally {
      await parser.destroy();
    }
  }
}

const parsers: DocumentParser[] = [new TxtParser(), new DocxParser(), new PdfParser()];

export async function parseUploadedDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ParsedDocument> {
  const parser = parsers.find((candidate) => candidate.supports(filename, mimeType));
  if (!parser) {
    throw new Error("Unsupported file type. Please upload TXT, PDF, or DOCX.");
  }
  return parser.parse(buffer, filename, mimeType);
}
