export type Curve = { fn: 'quadratic' | 'linear' | 'exponential' | 'sine' | 'logarithm'; a: number; b: number; c: number; label: string };
export type Graph = { xMin: number; xMax: number; curves: Curve[] };
export type StudyVisual = { kind: 'graph' | 'flow' | 'comparison' | 'formula'; after: string; title: string; caption: string; graph: Graph | null; supplement?: boolean;
  terms: { text: string; meaning: string; role: 'input' | 'operation' | 'result' | 'plain' }[]; nodes: { label: string; detail: string }[] };
export function cleanVisuals(value: unknown, text: string): StudyVisual[] | undefined;
export function curveValue(curve: Curve, x: number): number | null;
export function curveFormula(curve: Curve): string;
export function graphData(graph: Graph): { curves: { label: string; points: { x: number; y: number | null }[] }[]; min: number; max: number } | null;
