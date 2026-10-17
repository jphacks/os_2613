import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { loadReviews, type ReviewFeed } from './api';
export function useReviewFeed(book?: string, did?: string) {
  const [data, setData] = useState<ReviewFeed | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), controller = useRef<AbortController | null>(null), busy = useRef(false);
  const refresh = useCallback(async () => {
    const epoch = ++generation.current;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    busy.current = true; setLoading(true); setError(''); setData(null);
    try { const result = await loadReviews({ book, did }, abort.signal); if (generation.current === epoch) setData(result); }
    catch (e) { if (!abort.signal.aborted && generation.current === epoch) setError(e instanceof Error ? e.message : 'レビューを取得できません。'); }
    finally { if (generation.current === epoch) { setLoading(false); busy.current = false; } }
  }, [book, did]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { generation.current++; controller.current?.abort(); busy.current = false; }; }, [refresh]));
  async function more() {
    if (busy.current || data?.next === null || data?.next === undefined) return;
    const epoch = generation.current; busy.current = true; setLoading(true); setError('');
    try { const result = await loadReviews({ book, did, cursor: data.next }); if (generation.current === epoch) setData(before => before ? { ...result, reviews: [...before.reviews, ...result.reviews.filter(item => !before.reviews.some(old => old.uri === item.uri))] } : result); }
    catch (e) { if (generation.current === epoch) setError(e instanceof Error ? e.message : '取得できません。'); }
    finally { if (generation.current === epoch) { busy.current = false; setLoading(false); } }
  }
  return { data, loading, error, refresh, more };
}
