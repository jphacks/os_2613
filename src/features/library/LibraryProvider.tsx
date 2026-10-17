import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { SavedBook } from './types';
import { createLibraryRepository } from './repository.mjs';
import { libraryStorage } from './storage';

type Library = { books: SavedBook[]; ready: boolean; warning: string; addBook: (book: SavedBook) => Promise<void> };
const LibraryContext = createContext<Library | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState('');
  const [repository] = useState(() => createLibraryRepository(libraryStorage));
  useEffect(() => {
    let active = true;
    void repository.load().then(saved => { if (active) setBooks(saved); })
      .catch(() => { if (active) setWarning('本棚を読み込めません。端末の保存設定を確認してください。既存データは上書きしていません。'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [repository]);

  async function addBook(book: SavedBook) {
    if (!ready || warning) throw new Error('本棚の保存設定を確認して、アプリや画面を開き直してください。');
    try { setBooks(await repository.add(book)); }
    catch { throw new Error('本を保存できません。端末の空き容量や保存設定を確認して再試行してください。'); }
  }

  return <LibraryContext.Provider value={{ books, ready, warning, addBook }}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const library = useContext(LibraryContext);
  if (!library) throw new Error('LibraryProviderが必要です。');
  return library;
}
