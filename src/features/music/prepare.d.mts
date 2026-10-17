import type { SavedBook } from '../library/types';
import type { MusicPlan } from './plan-model.mjs';
export function prepareMusic(book: SavedBook, options?: { fetcher?: typeof fetch; signal?: AbortSignal; onPlan?: (plan: MusicPlan) => void; onProgress?: (message: string) => void }): Promise<{ plan: MusicPlan; cached: boolean }>;
