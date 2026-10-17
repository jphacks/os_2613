import AsyncStorage from '@react-native-async-storage/async-storage';

// 読書の記録（分析画面のもと）。
// 本ごとの「追加した日」「読み終わった日」と、読んだ時間の記録だけを端末に保存し、
// 今月の数字やグラフは表示するときに毎回この記録から計算する。

const statsKey = 'dopabooks:stats:v1';

export type Session = { bookId: string; seconds: number; at: number };
export type Stats = {
  books: Record<string, { addedAt?: number; finishedAt?: number }>;
  sessions: Session[];
};

const empty = (): Stats => ({ books: {}, sessions: [] });

export async function loadStats(): Promise<Stats> {
  try {
    const value = JSON.parse((await AsyncStorage.getItem(statsKey)) ?? 'null');
    if (!value || typeof value !== 'object') return empty();
    return {
      books: value.books && typeof value.books === 'object' ? value.books : {},
      sessions: Array.isArray(value.sessions) ? value.sessions.filter((s: Session) => Number.isFinite(s?.at) && Number.isFinite(s?.seconds)) : [],
    };
  } catch {
    return empty();
  }
}

// 記録の更新は順番に行う（同時に書くと、片方の記録が消えるため）
let queue = Promise.resolve();
function update(change: (stats: Stats) => Stats) {
  queue = queue.then(async () => {
    const next = change(await loadStats());
    await AsyncStorage.setItem(statsKey, JSON.stringify(next));
  }).catch(() => {});
  return queue;
}

export function recordAdded(bookId: string, at = Date.now()) {
  return update(stats => stats.books[bookId]?.addedAt ? stats
    : { ...stats, books: { ...stats.books, [bookId]: { ...stats.books[bookId], addedAt: at } } });
}

export function recordFinished(bookId: string, at = Date.now()) {
  return update(stats => stats.books[bookId]?.finishedAt ? stats
    : { ...stats, books: { ...stats.books, [bookId]: { ...stats.books[bookId], finishedAt: at } } });
}

// 読んだ時間を足す。同じ本を10分以内に続けて読んだときは1回分にまとめ、記録が増えすぎないようにする。
export function recordReading(bookId: string, seconds: number, at = Date.now()) {
  if (!(seconds >= 5)) return Promise.resolve();
  return update(stats => {
    const sessions = [...stats.sessions];
    const last = sessions[sessions.length - 1];
    if (last && last.bookId === bookId && at - last.at < 10 * 60 * 1000) sessions[sessions.length - 1] = { ...last, seconds: last.seconds + seconds, at };
    else sessions.push({ bookId, seconds, at });
    return { ...stats, sessions };
  });
}

const monthOf = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// 今月と全期間の数字
export function summarize(stats: Stats, now = Date.now()) {
  const month = monthOf(now);
  const books = Object.values(stats.books);
  const minutes = (list: Session[]) => Math.round(list.reduce((n, s) => n + s.seconds, 0) / 60);
  const count = (pick: (b: Stats['books'][string]) => number | undefined) => ({
    month: books.filter(b => pick(b) && monthOf(pick(b)!) === month).length,
    total: books.filter(b => pick(b)).length,
  });
  return {
    month,
    added: count(b => b.addedAt),
    finished: count(b => b.finishedAt),
    minutes: { month: minutes(stats.sessions.filter(s => monthOf(s.at) === month)), total: minutes(stats.sessions) },
  };
}

// 直近の月ごとの読書時間（分）。棒グラフに使う。
export function monthlyMinutes(stats: Stats, months = 6, now = Date.now()) {
  const base = new Date(now);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - (months - 1 - i), 1);
    const key = monthOf(d.getTime());
    const seconds = stats.sessions.filter(s => monthOf(s.at) === key).reduce((n, s) => n + s.seconds, 0);
    return { key, label: `${d.getMonth() + 1}月`, minutes: Math.round(seconds / 60) };
  });
}

// 直近7日の読書時間（分）。曜日ごとの棒に使う。
export function dailyMinutes(stats: Stats, days = 7, now = Date.now()) {
  const names = ['日', '月', '火', '水', '木', '金', '土'];
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const start = today.getTime() - (days - 1 - i) * 86400000;
    const seconds = stats.sessions.filter(s => s.at >= start && s.at < start + 86400000).reduce((n, s) => n + s.seconds, 0);
    return { key: String(start), label: names[new Date(start).getDay()], minutes: Math.round(seconds / 60) };
  });
}
