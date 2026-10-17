import type { SavedBook, SearchResult } from '../features/library/types';
export function createAozoraService(options?: { fetcher?: typeof fetch; cachePath?: string | null; maxAgeMs?: number }): {
  search(query: string, field: string, page: number): Promise<SearchResult>;
  importBook(id: number): Promise<SavedBook>;
};
