import AsyncStorage from '@react-native-async-storage/async-storage';
import { artifactUrl } from '@/features/comic/api';
import type { SavedBook } from '@/features/library/types';
import { loadReviews } from '@/features/reviews/api';
import { loadStats } from '@/features/stats/stats';
import { publishRecommendation, type WidgetRecommendation } from './bookmarks';

// ウィジェットの「今日のおすすめ」を選ぶ。
// ・候補は青空文庫の名作。読み終えた本は外し、残りから日付で1冊を決める（同じ日は同じ本）
//   本棚に無い本も、本棚にあって読み終えていない本も候補にする
// ・青空文庫の ID は題名で検索して引く（手で書くと間違えたとき別の本が開くため）
// ・星は、その本のレビューの実際の集計（平均と件数）。レビューが無ければ件数0で、ウィジェットは星を出さない
// ・押したときは、その本の紹介画面（/reviews/本のID）を開く

const candidates = [
  { title: '走れメロス', author: '太宰', blurb: '友を人質に、三日で戻ると誓った男の全力疾走。' },
  { title: '羅生門', author: '芥川', blurb: '雨の夜、行き場を失った下人が下した決断。' },
  { title: '蜘蛛の糸', author: '芥川', blurb: '地獄に垂らされた一本の糸と、人の心。' },
  { title: '注文の多い料理店', author: '宮沢', blurb: '山奥の洋食店。扉を開けるたびに増える注文。' },
  { title: '坊っちゃん', author: '夏目', blurb: '無鉄砲な新米教師が、田舎の学校で大暴れ。' },
  { title: 'こころ', author: '夏目', blurb: '「先生」が遺した手紙に書かれた、若き日の秘密。' },
  { title: '銀河鉄道の夜', author: '宮沢', blurb: '少年ジョバンニとカムパネルラの、星空の旅。' },
  { title: '山月記', author: '中島', blurb: '詩人になれなかった男は、虎になった。' },
];

const cacheKey = 'dopabooks:recommend:v1';
const today = () => new Date().toISOString().slice(0, 10);

// 題名で青空文庫を検索し、作者が合う作品の ID を返す（見つからなければ null）
async function findAozoraId(title: string, author: string) {
  const params = new URLSearchParams({ q: title, field: 'title', page: '1' });
  const response = await fetch(artifactUrl(`/api/aozora?${params}`), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;
  const data = await response.json();
  const hit = (data?.results ?? []).find((item: { title: string; author: string }) => item.title === title && item.author.includes(author));
  return hit ? (hit.id as string) : null;
}

export async function refreshRecommendation(library: SavedBook[]) {
  try {
    const stats = await loadStats();
    const finished = (id: string) => !!stats.books[id]?.finishedAt;

    // 同じ日は同じ本にする（毎回検索しないよう、選んだ結果を覚えておく）
    let pick: Omit<WidgetRecommendation, 'rating' | 'reviews'> | null = null;
    try {
      const cached = JSON.parse((await AsyncStorage.getItem(cacheKey)) ?? 'null');
      if (cached?.day === today() && cached.pick && !finished(cached.pick.bookId)) pick = cached.pick;
    } catch { /* 覚えた内容が壊れていたら選び直す */ }

    if (!pick) {
      const day = Math.floor(Date.now() / 86400000);
      // 日付で決めた位置から順に、読み終えていない作品が見つかるまで試す
      for (let i = 0; i < candidates.length && !pick; i++) {
        const c = candidates[(day + i) % candidates.length];
        const shelf = library.find(book => book.title === c.title && book.author.includes(c.author));
        const id = shelf?.id ?? await findAozoraId(c.title, c.author);
        if (!id || finished(id)) continue;
        pick = { bookId: id, title: c.title, author: shelf?.author ?? c.author, blurb: c.blurb, link: `dopabooks://reviews/${id}` };
      }
      if (!pick) return;
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ day: today(), pick }));
    }

    // 星は実際のレビューの集計。読めないときや0件なら星を出さない
    let rating = 0, reviews = 0;
    try {
      const feed = await loadReviews({ book: pick.bookId });
      reviews = feed.stats.count;
      rating = feed.stats.average ?? 0;
    } catch { /* 集計が読めなければ星なし */ }

    publishRecommendation({ ...pick, rating: Math.round(rating * 10) / 10, reviews });
  } catch {
    // おすすめを選べなくても、アプリの動きには影響させない
  }
}
