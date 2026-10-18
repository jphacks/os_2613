export function pdfSource(uri: string, readLocalPdf?: () => Promise<string>): Promise<{ url: string; data?: never } | { data: Uint8Array; url?: never }>;
