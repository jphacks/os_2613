export type Person = { id: string; name: string; quote: string; start: number; end: number };
export type Relation = { from: string; to: string; label: string; quote: string; start: number; end: number };
export type Graph = { people: Person[]; relations: Relation[] };
export const characterLimit: number;
export function textToBookmark(text: string, marks: { id: string; offset: number }[], id: string): string;
export function groundedGraph(value: unknown, text: string): Graph;
