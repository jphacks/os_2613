import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMusic } from '../src/features/music/prepare.mjs';
const book = { title: '作品', text: '本文' };
const scene = { mood: 'calm', kind: 'ambience', query: 'forest birds ambience', candidates: [], selectedId: null };

test('背景と効果音を自動で保存し、同じ扉の音を複数の箇所で再利用する', async () => {
  const searches = [];
  const cue = { kind: 'effect', query: 'wood door opening', candidates: [], selectedId: null, start: 1 };
  const result = await prepareMusic(book, { fetcher: async (url, options) => {
    if (url.startsWith('/api/music?')) {
      const kind = new URL(url, 'http://app').searchParams.get('kind'); searches.push(kind);
      return Response.json({ tracks: [{ id: kind === 'effect' ? 99 : 42, kind }] });
    }
    const data = JSON.parse(options.body);
    return Response.json({ plan: data.action === 'save' ? data.plan : { timingVersion: 2, scenes: [{ ...scene, start: 0, end: 20 }], cues: [{ ...cue, id: 'a' }, { ...cue, id: 'b', start: 10 }] } });
  } });
  assert.deepEqual(searches, ['ambience', 'effect']);
  assert.deepEqual(result.plan.cues.map(cue => cue.selectedId), [99, 99]);
});
test('ボタン1回で環境音取得・自動選択・順次保存を行い、同じ検索語を再利用する', async () => {
  let searches = 0, saves = 0;
  const updates = [];
  const result = await prepareMusic(book, { onPlan: plan => updates.push(plan), fetcher: async (url, options) => {
    if (url.startsWith('/api/music?')) { searches++; assert.equal(new URL(url, 'http://app').searchParams.get('kind'), 'ambience'); return Response.json({ tracks: [{ id: 42, kind: 'ambience' }] }); }
    const data = JSON.parse(options.body);
    if (data.action === 'analyze') return Response.json({ plan: { timingVersion: 2, scenes: [{ ...scene, start: 0, end: 1 }, { ...scene, start: 1, end: 2 }] }, cached: false });
    assert.equal(data.action, 'save'); saves++; return Response.json({ plan: data.plan });
  } });
  assert.equal(searches, 1); assert.equal(saves, 2);
  assert.equal(result.plan.scenes[1].selectedId, 42); assert.equal(updates.length, 3);
});
test('選択済みの案では候補を探し直さず保存データだけで完了する', async () => {
  let calls = 0;
  await prepareMusic(book, { fetcher: async (url, options) => {
    calls++; assert.equal(JSON.parse(options.body).action, 'analyze');
    return Response.json({ plan: { timingVersion: 2, scenes: [{ ...scene, start: 0, end: book.text.length, candidates: [{ id: 7, kind: 'ambience', name: 'forest birds ambience', tags: ['forest', 'birds'] }], selectedId: 7 }] }, cached: true });
  } });
  assert.equal(calls, 1);
});
test('途中の取得失敗では保存済み分析を捨てず、エラーを表示する', async () => {
  let saved;
  await assert.rejects(prepareMusic(book, { onPlan: plan => { saved = plan; }, fetcher: async url => url.startsWith('/api/music?') ? Response.json({ error: '通信できません' }, { status: 503 }) : Response.json({ plan: { timingVersion: 2, scenes: [{ ...scene, start: 0, end: book.text.length }] }, cached: true }) }), /通信できません/);
  assert.equal(saved.scenes.length, 1);
});
