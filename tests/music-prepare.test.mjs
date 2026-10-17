import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMusic } from '../src/features/music/prepare.mjs';
const book = { title: '作品', text: '本文' };
const scene = { mood: 'calm', kind: 'ambience', query: 'forest birds ambience', candidates: [], selectedId: null };
test('ボタン1回で環境音取得・自動選択・順次保存を行い、同じ検索語を再利用する', async () => {
  let searches = 0, saves = 0;
  const updates = [];
  const result = await prepareMusic(book, { onPlan: plan => updates.push(plan), fetcher: async (url, options) => {
    if (url.startsWith('/api/music?')) { searches++; assert.equal(new URL(url, 'http://app').searchParams.get('kind'), 'ambience'); return Response.json({ tracks: [{ id: 42 }] }); }
    const data = JSON.parse(options.body);
    if (data.action === 'analyze') return Response.json({ plan: { scenes: [{ ...scene }, { ...scene }] }, cached: false });
    assert.equal(data.action, 'save'); saves++; return Response.json({ plan: data.plan });
  } });
  assert.equal(searches, 1); assert.equal(saves, 2);
  assert.equal(result.plan.scenes[1].selectedId, 42); assert.equal(updates.length, 3);
});
test('選択済みの案では候補を探し直さず保存データだけで完了する', async () => {
  let calls = 0;
  await prepareMusic(book, { fetcher: async (url, options) => {
    calls++; assert.equal(JSON.parse(options.body).action, 'analyze');
    return Response.json({ plan: { scenes: [{ ...scene, candidates: [{ id: 7 }], selectedId: 7 }] }, cached: true });
  } });
  assert.equal(calls, 1);
});
test('途中の取得失敗では保存済み分析を捨てず、エラーを表示する', async () => {
  let saved;
  await assert.rejects(prepareMusic(book, { onPlan: plan => { saved = plan; }, fetcher: async url => url.startsWith('/api/music?') ? Response.json({ error: '通信できません' }, { status: 503 }) : Response.json({ plan: { scenes: [scene] }, cached: true }) }), /通信できません/);
  assert.equal(saved.scenes.length, 1);
});
