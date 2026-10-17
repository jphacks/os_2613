import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import type { SavedBook } from './types';

const storageKey = 'dopabooks:library:v1';
type Library = { books: SavedBook[]; ready: boolean; warning: string; addBook: (book: SavedBook) => void };
const LibraryContext = createContext<Library | null>(null);

function isSavedBook(value: unknown): value is SavedBook {
  if (!value || typeof value !== 'object') return false;
  const book = value as SavedBook;
  return typeof book.id === 'string' && /^aozora-\d+$/.test(book.id) && Number.isSafeInteger(book.aozoraId)
    && ['title', 'author', 'subtitle', 'text', 'characters', 'cardUrl', 'htmlUrl', 'importedAt'].every(key => typeof book[key as keyof SavedBook] === 'string');
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState('');
  const current = useRef<SavedBook[]>([]);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
      if (!Array.isArray(saved) || !saved.every(isSavedBook)) throw new Error('invalid');
      current.current = saved; setBooks(saved);
    } catch { setWarning('本棚を読み込めません。ブラウザーの保存設定を確認してください。既存データは上書きしていません。'); }
    setReady(true);
  }, []);

  function addBook(book: SavedBook) {
    if (!ready || warning) throw new Error('本棚の保存設定を確認して、画面を再読み込みしてください。');
    if (!isSavedBook(book)) throw new Error('作品データを確認できません。もう一度検索して追加してください。');
    if (current.current.some(item => item.id === book.id)) return;
    const next = [...current.current, book];
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { throw new Error('本を保存できません。ブラウザーの空き容量や保存設定を確認してください。'); }
    current.current = next; setBooks(next);
  }

  return <LibraryContext.Provider value={{ books, ready, warning, addBook }}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const library = useContext(LibraryContext);
  if (!library) throw new Error('LibraryProviderが必要です。');
  return library;
}
