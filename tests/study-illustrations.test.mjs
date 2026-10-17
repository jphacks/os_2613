import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudyIllustrations, createIllustrationProvider, validateIllustrationPlan } from '../src/server/study-illustrations.mjs';

const input = { id: 'calculus', hash: 'source-hash', unit: 0, level: 'beginner', source: '数直線で実数の大小を比較します。', lesson: '数直線で実数の大小を比べてみましょう。' };
const figure = { after: input.lesson, sourceQuote: input.source, title: '実数の大小', caption: '右側ほど大きい実数を表します。', scene: '白い背景に実数の位置関係を示す概念イラスト。' };
const reply = figures => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ figures }) }] }] });
const png = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
const image = { data: [{ b64_json: png.toString('base64') }] };
test('旧設計の空白と改行を原文で照合し、本文と異なる挿入位置は補足図に戻す', () => {
  const source = 'この節では関数の極限の意味とその大切な性質を説明します。\n変数が近づくときの値を考えます。';
  const legacy = { ...figure, sourceQuote: source.replaceAll('の', ' の ').replace('\n', '\\n'), after: source };
  const restored = validateIllustrationPlan(reply([legacy]), { ...input, source });
  assert.ok(source.includes(restored[0].sourceQuote));
  assert.equal(restored[0].after, input.lesson); assert.equal(restored[0].supplement, true);
  assert.throws(() => validateIllustrationPlan(reply([{ ...legacy, sourceQuote: 'この節では関数と無関係な話をしており実在しない事実を説明します。' }]), { ...input, source }), /UNGROUNDED/);
});
test('候補IDから引用を復元し、不正な候補や本文外の挿入位置を拒否する', () => {
  const raw = { ...reply([{ title: figure.title, caption: figure.caption, scene: figure.scene, afterId: 0, sourceId: 0 }]), anchorManifest: { source: [input.source], lesson: [input.lesson] } };
  const restored = validateIllustrationPlan(raw, input)[0];
  assert.equal(restored.after, input.lesson); assert.equal(restored.sourceQuote, input.source);
  assert.throws(() => validateIllustrationPlan({ ...raw, anchorManifest: { ...raw.anchorManifest, lesson: ['本文にない引用です。'] } }, input), /UNGROUNDED/);
});
async function fixture(t, provider) {
  const root = await mkdtemp(join(tmpdir(), 'study-illustrations-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, service: createStudyIllustrations({ root, provider }) };
}
test('挿絵は表示では作らず、連打・再起動でも保存した画像を再利用する', async t => {
  let plans = 0, images = 0;
  const provider = { plan: async () => { plans++; return reply([figure, figure]); }, image: async () => { images++; return image; } };
  const { service, root } = await fixture(t, provider);
  assert.equal((await service.read(input)).complete, false); assert.equal(plans, 0);
  const [a, b] = await Promise.all([service.generate(input), service.generate(input)]);
  assert.deepEqual(a, b); assert.equal(a.complete, true); assert.equal(a.visuals.length, 2);
  await createStudyIllustrations({ root, provider }).generate(input);
  assert.equal(plans, 1); assert.equal(images, 2);
  assert.equal((await service.read({ ...input, level: 'standard' })).complete, false);
  assert.equal((await service.read({ ...input, hash: 'changed-source' })).complete, false);
  const url = `http://app.test${a.visuals[0].imageUrl}`;
  const response = await service.image(new Request(url)); assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal((await service.image(new Request('http://app.test/api/study-illustration?key=../../secret&image=1'))).status, 400);
});
test('途中の画像が失敗しても設計と完成画像は保持し、残りだけ再開する', async t => {
  let plans = 0, images = 0;
  const provider = { plan: async () => { plans++; return reply([figure, figure]); }, image: async () => { images++; if (images === 2) throw new Error('TIMEOUT'); return image; } };
  const { service, root } = await fixture(t, provider);
  await assert.rejects(service.generate(input), /TIMEOUT/);
  assert.equal((await service.read(input)).visuals.length, 1);
  assert.equal((await createStudyIllustrations({ root, provider }).generate(input)).complete, true);
  assert.equal(plans, 1); assert.equal(images, 3);
});

test('はさみうちの図は画像APIを使わず、既存の画像も計算グラフへ置き換える', async t => {
  const { service } = await fixture(t, { plan: async () => reply([{ ...figure, title: 'はさみうちの原理' }]), image: async () => assert.fail('数学の曲線を画像生成しない') });
  const result = await service.generate(input);
  assert.equal(result.complete, true); assert.equal(result.visuals[0].kind, 'graph');
  assert.equal((await service.read(input)).visuals[0].kind, 'graph');
});
test('本文と原文の根拠が一致しない設計や壊れた画像は保存して再課金しない', async t => {
  let calls = 0;
  const provider = { plan: async () => { calls++; return reply([{ ...figure, sourceQuote: '無関係な別の資料です。' }]); }, image: async () => assert.fail('根拠がない絵を作らない') };
  const { service, root } = await fixture(t, provider);
  await assert.rejects(service.generate(input), /UNGROUNDED/);
  await assert.rejects(createStudyIllustrations({ root, provider }).generate(input), /UNGROUNDED/); assert.equal(calls, 1);
  assert.throws(() => validateIllustrationPlan(reply([figure, figure]), { ...input, level: 'standard' }), /INVALID_RESULT/);
  let images = 0;
  const other = await fixture(t, { plan: async () => reply([figure]), image: async () => { images++; return { data: [{ b64_json: 'broken' }] }; } });
  await assert.rejects(other.service.generate(input), /INVALID_RESULT/);
  await assert.rejects(other.service.generate(input), /INVALID_RESULT/); assert.equal(images, 1);
});
test('画像生成はキーをヘッダーだけに送り、モデル・枚数・サイズを制限する', async () => {
  const provider = createIllustrationProvider({ key: () => 'test-key', fetcher: async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-key'); assert.ok(!options.body.includes('test-key'));
    const body = JSON.parse(options.body);
    if (url.endsWith('/responses')) { assert.equal(body.store, false); assert.equal(body.text.format.schema.properties.figures.maxItems, 1); return Response.json(reply([figure])); }
    assert.equal(url, 'https://api.openai.com/v1/images/generations'); assert.equal(body.model, 'gpt-image-1.5'); assert.equal(body.n, 1); assert.equal(body.output_format, 'png'); return Response.json(image);
  } });
  await provider.plan({ ...input, level: 'standard' }); await provider.image(figure);
});
