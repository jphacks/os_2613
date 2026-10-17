// Resume from saved analysis/candidates. Only an explicit button calls this flow.
export async function prepareMusic(book, { fetcher = fetch, signal, onPlan = () => {}, onProgress = () => {} } = {}) {
  const source = { title: book.title, text: book.text };
  if (typeof source.text !== 'string' || source.text.length > 60000) throw new Error('60,000文字以内の作品でお試しください。');
  async function request(action, plan) {
    const response = await fetcher('/api/music-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ action, book: source, ...(plan ? { plan } : {}) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'BGMを準備できません。もう一度お試しください。');
    return data;
  }
  onProgress('保存済みの選曲を確認しています…');
  const result = await request('analyze'); // Server always checks persistent files before any paid analysis.
  let plan = result.plan;
  onPlan(plan);
  const reused = new Map();
  for (const scene of plan.scenes) if (scene.candidates.length) reused.set(`${scene.kind ?? 'music'}:${scene.mood}:${scene.query}`, scene.candidates);
  for (let index = 0; index < plan.scenes.length; index++) {
    const scene = plan.scenes[index];
    if (scene.candidates.some(track => track.id === scene.selectedId)) continue;
    onProgress(`場面 ${index + 1}/${plan.scenes.length} のBGMを準備しています…`);
    const key = `${scene.kind ?? 'music'}:${scene.mood}:${scene.query}`;
    let tracks = scene.candidates.length ? scene.candidates : reused.get(key);
    if (!tracks) {
      const params = new URLSearchParams({ mood: scene.mood, q: scene.query, kind: scene.kind ?? 'music' });
      const response = await fetcher(`/api/music?${params}`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '曲を取得できません。分析は保存済みなので、BGM取得で再開できます。');
      tracks = data.tracks; reused.set(key, tracks);
    }
    plan = { ...plan, scenes: plan.scenes.map((item, i) => i === index ? { ...item, candidates: tracks, selectedId: tracks[0]?.id ?? null } : item) };
    plan = (await request('save', plan)).plan;
    onPlan(plan);
  }
  return { plan, cached: result.cached };
}
