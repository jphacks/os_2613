import type { SavedBook } from './types';
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export function isSavedBook(value: unknown): value is SavedBook;
export function createLibraryRepository(storage: Storage, initialBooks?: SavedBook[]): { load(): Promise<SavedBook[]>; add(book: SavedBook): Promise<SavedBook[]> };
