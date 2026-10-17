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
  const tasks = [...plan.scenes.map((scene, index) => ({ group: 'scenes', index })), ...(plan.cues ?? []).map((cue, index) => ({ group: 'cues', index }))];
  const keyFor = item => `${item.kind ?? 'music'}:${item.mood ?? ''}:${item.query}`;
  for (const item of [...plan.scenes, ...(plan.cues ?? [])]) if (item.candidates.length) reused.set(keyFor(item), item.candidates);
  const queried = new Set(reused.keys());
  for (const { group, index } of tasks) {
    const scene = plan[group][index];
    if (scene.candidates.some(track => track.id === scene.selectedId)) continue;
    onProgress(`${group === 'cues' ? '重ねる音' : '背景音'} ${index + 1}/${plan[group].length} を準備しています…`);
    const mood = scene.mood ?? plan.scenes.find(item => scene.start >= item.start && scene.start < item.end)?.mood ?? 'calm';
    const key = keyFor(scene);
    let tracks = scene.candidates.length ? scene.candidates : reused.get(key);
    if (!tracks) {
      if (queried.size >= 40) continue;
      queried.add(key);
      const params = new URLSearchParams({ mood, q: scene.query, kind: scene.kind ?? 'music' });
      const response = await fetcher(`/api/music?${params}`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '曲を取得できません。分析は保存済みなので、BGM取得で再開できます。');
      tracks = data.tracks; reused.set(key, tracks);
    }
    if (group === 'cues') tracks = tracks.filter(track => track.kind === scene.kind);
    plan = { ...plan, [group]: plan[group].map((item, i) => i === index ? { ...item, candidates: tracks, selectedId: tracks[0]?.id ?? null } : item) };
    plan = (await request('save', plan)).plan;
    onPlan(plan);
  }
  return { plan, cached: result.cached };
}
