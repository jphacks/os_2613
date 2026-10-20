import type { ReviewRecord } from './model.mjs';
export function blueskyTid(milliseconds: number, clock?: number): string;
export function shareBluesky(options: { did: string; review: ReviewRecord; request: (path: string, init?: RequestInit) => Promise<any>; storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> }; digest?: (value: string) => Promise<string>; now?: () => number }): Promise<string>;
