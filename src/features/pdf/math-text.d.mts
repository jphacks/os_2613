import type { TextContent, TextItem, PDFOperatorList } from 'pdfjs-dist/types/src/display/api';
export function missingMathBars(operators: PDFOperatorList, ops: Record<string, number>, fonts: Record<string, string>): TextItem[];
export function repairMathText(content: TextContent, fonts: Record<string, string>, bars?: TextItem[]): TextContent;
