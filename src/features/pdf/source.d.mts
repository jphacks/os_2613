export const PDF_CHUNK_BYTES: number;
export type ReadLocalPdf = (offset: number, length: number) => Promise<{ size: number; base64: string }>;
export function pdfSource(uri: string, readLocalPdf?: ReadLocalPdf, cancelled?: () => boolean): Promise<{ url: string; data?: never } | { data: Uint8Array; url?: never }>;
