import { books as bundled } from '@/content/books';
import type { SavedBook } from '@/features/library/types';
import { validBookId, type ReviewBook } from './model.mjs';
export function reviewBooks(saved: SavedBook[]): ReviewBook[] {
  return [...saved.filter(book => validBookId(book.id)), ...bundled.filter(book => book.kind === 'study')].map(({ id, title, author }) => ({ id, title, author }));
}
