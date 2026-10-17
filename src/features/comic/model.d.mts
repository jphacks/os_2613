export type Balloon = { kind: 'speech' | 'thought' | 'narration'; slot: 'left' | 'right' | 'bottom'; speaker: string; text: string; quote: string; start: number; end: number };
export type ComicPanel = { title: string; caption: string; scene: string; quote: string; start: number; end: number; balloons?: Balloon[] };
export type Script = { cast: string; panels: ComicPanel[]; format?: 'manga-v2' };
export const comicVersion: number;
export function introPassages(opening: string): { id: string; quote: string; start: number; end: number }[];
export function scriptFromPassages(value: unknown, opening: string): Script;
export function comicFailureMessage(code: string | undefined, hasScript: boolean, completed?: number): string;
export function introSource(text: string, title: string): { opening: string; context: string };
export function validateScript(value: unknown, opening: string): Script;
