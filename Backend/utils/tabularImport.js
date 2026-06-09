import path from "node:path";
import XLSX from "xlsx";
import { ApiError } from "./apiError.js";

export const SUPPORTED_TABULAR_EXTENSIONS = new Set([".xlsx", ".xls", ".csv", ".tsv", ".txt"]);
export const SUPPORTED_TABULAR_FORMAT_LABEL = "Excel (.xlsx, .xls), CSV (.csv), TSV (.tsv), or delimited text (.txt)";

function detectTextDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/, 1)[0] || "";
  const candidates = [
    ["\t", (firstLine.match(/\t/g) || []).length],
    [",", (firstLine.match(/,/g) || []).length],
    [";", (firstLine.match(/;/g) || []).length],
    ["|", (firstLine.match(/\|/g) || []).length]
  ].sort((left, right) => right[1] - left[1]);

  return candidates[0][1] > 0 ? candidates[0][0] : null;
}

export function getTabularFileExtension(fileName) {
  return path.extname(String(fileName || "")).toLowerCase();
}

export function assertSupportedTabularFile(fileName) {
  const extension = getTabularFileExtension(fileName);
  if (!SUPPORTED_TABULAR_EXTENSIONS.has(extension)) {
    throw new ApiError(
      400,
      `Unsupported file format. Upload ${SUPPORTED_TABULAR_FORMAT_LABEL}.`,
      {
        howToFix: "Save or export the sheet as XLSX, XLS, CSV, TSV, or a comma/tab/semicolon/pipe-delimited TXT file."
      }
    );
  }
  return extension;
}

export function readTabularBuffer(buffer, fileName) {
  const extension = assertSupportedTabularFile(fileName);
  let workbook;

  try {
    if (extension === ".csv" || extension === ".tsv" || extension === ".txt") {
      const text = Buffer.from(buffer).toString("utf8").replace(/^\uFEFF/, "");
      const delimiter = extension === ".tsv" ? "\t" : detectTextDelimiter(text);
      if (!delimiter) {
        throw new ApiError(
          400,
          "The text file delimiter could not be detected.",
          {
            howToFix: "Use a header row and separate every column with commas, tabs, semicolons, or pipe characters."
          }
        );
      }
      workbook = XLSX.read(text, { type: "string", raw: false, FS: delimiter });
    } else {
      workbook = XLSX.read(buffer, { type: "buffer", raw: false });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      "The uploaded sheet could not be read.",
      {
        howToFix: "Open the file in Excel or Google Sheets, confirm it is not password-protected or corrupted, then export it again in a supported format."
      }
    );
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new ApiError(
      400,
      "The uploaded file does not contain a readable worksheet.",
      { howToFix: "Add a worksheet containing a header row and at least one data row." }
    );
  }

  return XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
    blankrows: false
  });
}
