export type MathSegment = { start: number; end: number; raw: string; tex: string; markup: string; display: boolean };
export function normalizeMath(source: string): string;
export function studyNotation(text: string): string;
export function mathMarkup(source: string, display?: boolean): string | null;
export function mathSegments(text: string, formula?: boolean): MathSegment[];
