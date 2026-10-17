import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SavedBook } from './types';

const storageKey = 'dopabooks:library:v1';
type Library = { books: SavedBook[]; ready: boolean; warning: string; addBook: (book: SavedBook) => Promise<void> };
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
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(storageKey).then(raw => {
      const saved: unknown = JSON.parse(raw ?? '[]');
      if (!Array.isArray(saved) || !saved.every(isSavedBook)) throw new Error('invalid');
      if (alive) { current.current = saved; setBooks(saved); }
    }).catch(() => { if (alive) setWarning('本棚を読み込めません。端末の保存設定を確認してください。既存データは上書きしていません。'); })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  async function addBook(book: SavedBook) {
    if (!ready || warning) throw new Error('本棚の保存設定を確認して、画面を再読み込みしてください。');
    if (!isSavedBook(book)) throw new Error('作品データを確認できません。もう一度検索して追加してください。');
    const task = writes.current.then(async () => {
      if (current.current.some(item => item.id === book.id)) return;
      const next = [...current.current, book];
      try { await AsyncStorage.setItem(storageKey, JSON.stringify(next)); }
      catch { throw new Error('本を保存できません。端末の空き容量や保存設定を確認してください。'); }
      current.current = next; setBooks(next);
    });
    writes.current = task.catch(() => {});
    await task;
  }

  return <LibraryContext.Provider value={{ books, ready, warning, addBook }}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const library = useContext(LibraryContext);
  if (!library) throw new Error('LibraryProviderが必要です。');
  return library;
}
