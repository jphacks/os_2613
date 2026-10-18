import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ホーム画面のウィジェットに渡すデータを管理する。
//
// ・読んでいる本：本ごとに「最後に読んだ位置」と「その位置までのまとめ」を覚え、最後に読んだ本を先頭にする。
//   ウィジェットは先頭の1冊だけを表示する（しおりを動かしても、最後に読んだ位置は変わらない）。
// ・今日のおすすめ：本棚に無い本・読み終えていない本から日替わりで選んだ1冊と、実際のレビューの集計。
// iPhone では App Group（アプリとウィジェットが共有できる保存場所）に書き出してウィジェットを更新する。
// Web にはウィジェットが無いので、覚えるだけにする。

const groupId = 'group.jp.dopabooks.app';
const storeKey = 'dopabooks:widget:v1';
const MAX_BOOKS = 10; // 覚えておく本の上限（分析画面の「読みかけの本」でも使う）

export type WidgetBook = {
  bookId: string;
  title: string;
  author: string;
  excerpt: string; // 最後に読んだ位置の直前の文
  offset: number; // 最後に読んだ位置（ウィジェットを押したとき、ここを開く）
  summary: string; // その位置までのまとめ（1つ前のしおりから今の位置までの要約。まだ無ければ空）
  summaryOffset: number; // まとめを作ったときの位置（読み進めたら作り直すかの判断に使う）
  progress: number; // 最後に読んだ位置が本の何%か
  updatedAt: number; // 最後に読んだ時刻
};

export type WidgetRecommendation = {
  bookId: string;
  title: string;
  author: string;
  blurb: string;
  rating: number; // 実際のレビューの平均（0〜5）。レビューが無ければ 0
  reviews: number; // レビューの件数。0 ならウィジェットは星を出さない
  link: string; // 押したときに開く場所（本の紹介画面）
};

// 覚えている本の一覧（最後に読んだ順）。分析画面でも使う。
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

// iPhone のときだけ、ウィジェットと共有する場所へ書き出して更新する
function publish(key: string, value: Record<string, string | number>[]) {
  if (Platform.OS !== 'ios') return;
  try {
    // ウィジェット用の部品は iPhone のネイティブ機能なので、iPhone のときだけ読み込む
    const { ExtensionStorage } = require('@bacons/apple-targets') as typeof import('@bacons/apple-targets');
    new ExtensionStorage(groupId).set(key, value);
    ExtensionStorage.reloadWidget();
  } catch {
    // 古い開発用ビルドなど、ウィジェットの部品が無いときは何もしない
  }
}

async function save(books: WidgetBook[]) {
  // 最後に読んだ本から順に並べる（ウィジェットは先頭の1冊を出す）
  const sorted = [...books].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_BOOKS);
  await AsyncStorage.setItem(storeKey, JSON.stringify(sorted));
  publish('bookmarks', sorted);
}

// 本の情報を覚える（一部だけ渡したときは、前の値を残して上書きする）
export async function rememberWidgetBook(update: Partial<WidgetBook> & { bookId: string }) {
  const books = await load();
  const before = books.find(book => book.bookId === update.bookId);
  const next: WidgetBook = {
    title: '', author: '', excerpt: '', offset: 0, summary: '', summaryOffset: 0, progress: 0, updatedAt: Date.now(),
    ...before,
    ...update,
  };
  if (!next.title) return; // 本の情報がまだ無いときは書かない
  if (before && JSON.stringify(before) === JSON.stringify(next)) return;
  await save([...books.filter(book => book.bookId !== update.bookId), next]);
}

// 本棚から消した本などを、ウィジェットから外す
export async function forgetWidgetBook(bookId: string) {
  const books = await load();
  if (!books.some(book => book.bookId === bookId)) return;
  await save(books.filter(book => book.bookId !== bookId));
}

// 今日のおすすめを、ウィジェットと共有する場所へ書き出す
export function publishRecommendation(recommendation: WidgetRecommendation) {
  publish('recommendations', [recommendation]);
}
