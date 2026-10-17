export function measuredPages(text: string, pageOf: (offset: number) => number): number[];
export function measuredPagesAsync(text: string, pageOf: (offset: number) => number, options?: { yieldControl?: () => Promise<unknown>; shouldCancel?: () => boolean; now?: () => number; budgetMs?: number }): Promise<number[] | null>;
export function pageAtOffset(starts: number[], offset: number): number;
export function pageFromTrack(x: number, width: number, count: number): number;
