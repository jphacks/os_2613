export type PdfMark = { id: string; source: string; page: number; offset: number | null; quote: string };
export function parsePdfMarks(raw: string | null): PdfMark[];
export function pdfCharacter(text: string, offset: number): { offset: number; length: number; quote: string } | null;
