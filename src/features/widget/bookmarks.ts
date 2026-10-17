import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ホーム画面のウィジェットに出す「しおりを挟んだ本」の一覧を管理する。
//
// しおりを挟んだ本ごとに「最新のしおりの位置」と「前回までのまとめ」を覚えておき、
// iPhone では App Group（アプリとウィジェットが共有できる保存場所）に書き出してウィジェットを更新する。
// Web にはウィジェットが無いので、一覧を覚えるだけにする。

const groupId = 'group.jp.dopabooks.app';
const storeKey = 'dopabooks:widget:v1';
const MAX_BOOKS = 10; // ウィジェットで順番に見せる本の上限

export type WidgetBook = {
  bookId: string;
  title: string;
  author: string;
  excerpt: string; // しおりの直前の文
  summary: string; // 前回までのまとめ（まだ作っていなければ空）
  progress: number; // しおりの位置が本の何%か
  updatedAt: number;
};

// しおりを挟んだ本の一覧（新しい順）。分析画面でも使う。
export const listWidgetBooks = () => load();

async function load(): Promise<WidgetBook[]> {
  try {
    const raw = await AsyncStorage.getItem(storeKey);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function save(books: WidgetBook[]) {
  // 新しくしおりを挟んだ本から順に並べる
  const sorted = [...books].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_BOOKS);
  await AsyncStorage.setItem(storeKey, JSON.stringify(sorted));
  if (Platform.OS !== 'ios') return;
  try {
    // ウィジェット用の部品は iPhone のネイティブ機能なので、iPhone のときだけ読み込む
    const { ExtensionStorage } = require('@bacons/apple-targets') as typeof import('@bacons/apple-targets');
    new ExtensionStorage(groupId).set('bookmarks', sorted);
    ExtensionStorage.reloadWidget();
  } catch {
    // 古い開発用ビルドなど、ウィジェットの部品が無いときは何もしない
  }
}

// 本のしおり情報を覚える（一部だけ渡したときは、前の値を残して上書きする）
export async function rememberWidgetBook(update: Partial<WidgetBook> & { bookId: string }) {
  const books = await load();
  const before = books.find(book => book.bookId === update.bookId);
  // しおりの位置が変わったら、古い位置のまとめは外す
  const moved = before && update.excerpt !== undefined && update.excerpt !== before.excerpt;
  const next: WidgetBook = {
    title: '', author: '', excerpt: '', summary: '', progress: 0, updatedAt: Date.now(),
    ...before,
    ...(moved ? { summary: '' } : null),
    ...update,
  };
  if (!next.title) return; // 本の情報がまだ無いときは書かない
  const same = before && JSON.stringify(before) === JSON.stringify(next);
  if (same) return;
  await save([...books.filter(book => book.bookId !== update.bookId), next]);
}

// しおりが無くなった本をウィジェットから外す
export async function forgetWidgetBook(bookId: string) {
  const books = await load();
  if (!books.some(book => book.bookId === bookId)) return;
  await save(books.filter(book => book.bookId !== bookId));
}
