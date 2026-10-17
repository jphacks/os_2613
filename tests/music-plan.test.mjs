import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bookHash, bookInput, createMusicPlanner, createMusicPlanService, createMusicPlanEndpoint } from '../src/server/music-plan.mjs';
import { textUnits, validateScenes } from '../src/features/music/plan-model.mjs';

const book = { title: '試験作品', text: '雨の中を走る。友の命がかかっていた。' };
const scene = { start: 0, end: book.text.length, label: '友への決意', reason: '友を助けるため走る切迫感に、低い弦の音を合わせる。', mood: 'tense', query: 'suspense ambient strings', candidates: [], selectedId: null };
const planned = { scenes: [scene], usage: { input: 80, output: 40, total: 120 } };
const result = { scenes: [{ firstUnit: 0, lastUnit: 0, label: scene.label, reason: scene.reason, mood: scene.mood, query: scene.query }] };
const track = { id: 42, name: 'Strings music', creator: 'artist', license: 'https://creativecommons.org/licenses/by/4.0/', url: 'https://freesound.org/people/artist/sounds/42/', audioUrl: 'https://cdn.freesound.org/previews/42.mp3' };

test('本文を欠落・重複なく区切り、長文を黙って切り捨てない', () => {
  const text = ('あ'.repeat(600) + '\n😀').repeat(5);
  const units = textUnits(text);
  assert.equal(units.map(unit => unit.text).join(''), text);
  assert.equal(units[0].start, 0); assert.equal(units.at(-1).end, text.length);
  assert.throws(() => bookInput({ ...book, text: 'あ'.repeat(60001) }), /INPUT/);
  assert.throws(() => validateScenes([{ ...scene, start: 1 }], book.text.length), /INVALID_PLAN/);
  assert.throws(() => validateScenes([{ ...scene, end: book.text.length - 1 }], book.text.length), /INVALID_PLAN/);
  assert.throws(() => validateScenes([{ ...scene, candidates: [{ ...track, audioUrl: 'https://evil.test/music.mp3' }] }], book.text.length), /INVALID_PLAN/);
});
test('OpenAIには本文だけを資料として1回送信し、構造化出力・保存なし・出力上限を指定する', async () => {
  let calls = 0;
  const planner = createMusicPlanner({ key: () => 'secret-test', fetcher: async (url, options) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false); assert.equal(body.model, 'gpt-4.1-mini');
    assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.max_output_tokens, 4000);
    assert.equal(JSON.parse(body.input).units[0].text, book.text);
    assert.ok(!options.body.includes('secret-test'));
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(result) }] }], usage: { input_tokens: 80, output_tokens: 40, total_tokens: 120 } });
  } });
  assert.deepEqual(await planner(book), planned); assert.equal(calls, 1);
});
test('キー不在・拒否・未完了の応答では偽の分析を保存しない', async () => {
  await assert.rejects(createMusicPlanner({ key: () => '' })(book), /OPENAI_KEY/);
  for (const [response, code] of [[new Response('', { status: 401 }), 'OPENAI_AUTH'], [new Response('', { status: 400 }), 'OPENAI_REQUEST'], [Response.json({ status: 'incomplete', output: [] }), 'INCOMPLETE']]) {
    await assert.rejects(createMusicPlanner({ key: () => 'test', fetcher: async () => response })(book), new RegExp(code));
  }
});
test('同じ本文の連打をまとめ、再起動後も共有JSONと選択曲を再利用し、古い保存を拒否する', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'book-music-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let calls = 0;
  const service = createMusicPlanService({ directory, planner: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return planned; } });
  assert.equal(await service.load(book), null); assert.equal(calls, 0);
  const [first, second] = await Promise.all([service.analyze(book), service.analyze(book)]);
  assert.equal(calls, 1); assert.equal(first.plan.revision, second.plan.revision);
  const changed = { ...first.plan, scenes: [{ ...scene, query: 'dark strings music', candidates: [track], selectedId: 42, secret: 'must-not-save' }], apiKey: 'must-not-save' };
  const saved = await service.save(book, changed);
  await assert.rejects(service.save(book, changed), /CONFLICT/);
  const restarted = createMusicPlanService({ directory, planner: () => assert.fail('OpenAI called again') });
  assert.equal((await restarted.analyze(book)).cached, true);
  assert.equal((await restarted.load(book)).scenes[0].selectedId, 42);
  const raw = await readFile(join(directory, `${bookHash(book.text)}.json`), 'utf8');
  assert.ok(!raw.includes('must-not-save')); assert.ok(!raw.includes(book.text));
  assert.equal(JSON.parse(raw).revision, saved.revision);
  assert.equal((await readdir(directory)).length, 1);
});
test('不正な本文と外部Originを拒否し、API内部の秘密をエラーに含めない', async () => {
  const endpoint = createMusicPlanEndpoint({ service: { load: () => { throw new Error('provider-secret'); } } });
  const request = (data, origin = 'https://reader.test') => new Request('https://reader.test/api/music-plan', { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(data) });
  assert.equal((await endpoint(request({ action: 'load', book }, 'https://evil.test'))).status, 403);
  assert.equal((await endpoint(request({ action: 'load', book: { ...book, text: '' } }))).status, 400);
  const response = await endpoint(request({ action: 'load', book }));
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('provider-secret'));
});
