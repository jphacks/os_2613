import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { groundedGraph, textToBookmark } from '../src/features/characters/model.mjs';
import { comicFailureMessage, introPassages, introSource, scriptFromPassages, validateScript } from '../src/features/comic/model.mjs';
import { createCharactersEndpoint, createComicEndpoint } from '../src/server/book-artifacts.mjs';
import { createBookArtifactProvider } from '../src/server/book-artifact-provider.mjs';
import { artifactStorage } from '../src/server/artifact-storage.mjs';

const text = '太郎と花子は友人だった。二人は橋へ向かった。';
const quote = '太郎と花子は友人だった。';
const graph = { people: [{ id: 'a', name: '太郎', quote }, { id: 'b', name: '花子', quote }], relations: [{ from: 'a', to: 'b', label: '友人', quote }] };
const script = { cast: '太郎は短髪、花子は長髪。二人は白い服。', panels: Array.from({ length: 4 }, (_, i) => ({ title: `紹介${i + 1}`, caption: '太郎と花子は橋へ向かう。', scene: '二人が話す。', quote })) };
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5XkAAAAASUVORK5CYII=';
const fake = { characters: async () => graph, script: async () => script, image: async () => png };
const post = value => new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
const status = key => new Request(`http://localhost/api/comic?key=${key}`);
const register = endpoint => endpoint(post({ action: 'register', bookId: 'book', title: '物語', opening: text, context: text })).then(response => response.json());
async function finished(endpoint, key) {
  for (let i = 0; i < 150; i++) { const value = await (await endpoint(status(key))).json(); if (value.status !== 'running') return value; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw new Error('TEST_JOB_TIMEOUT');
}
async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), 'dopabooks-artifacts-'));
  t.after(async () => { if (!resolve(root).startsWith(resolve(tmpdir()) + sep + 'dopabooks-artifacts-')) throw new Error('UNSAFE_TEST_PATH'); await rm(root, { recursive: true, force: true }); });
  return root;
}
test('引用文はAIに書き写させず、紹介範囲から作った候補IDを原文へ戻す', () => {
  const opening = '「約束を守る」と、太郎は言った。\n' + '😀原文の表記はそのまま残す。'.repeat(25);
  const sources = introPassages(opening);
  assert.ok(sources.length > 1);
  for (const source of sources) {
    assert.equal(opening.slice(source.start, source.end), source.quote);
    assert.ok(source.quote.length <= 180);
    assert.ok(!/[\uDC00-\uDFFF]/.test(source.quote[0]));
  }
  const value = { cast: '太郎は短髪。', panels: Array.from({ length: 4 }, () => ({ title: '約束', caption: '太郎は約束を守ろうとする。', scene: '太郎が話す。', sourceId: sources[1].id, quote: 'AIが勝手に書き換えた引用' })) };
  const checked = scriptFromPassages(value, opening);
  assert.equal(checked.panels[0].quote, sources[1].quote);
  assert.equal(checked.panels[0].start, sources[1].start);
  assert.equal(validateScript(checked, opening).panels[0].start, sources[1].start);
  assert.throws(() => scriptFromPassages({ ...value, panels: [{ ...value.panels[0], sourceId: 'future' }] }, opening), /UNGROUNDED/);
  assert.throws(() => validateScript({ ...checked, panels: checked.panels.map(panel => ({ ...panel, start: opening.length, end: opening.length + panel.quote.length })) }, opening), /UNGROUNDED/);
});
test('脚本段階の根拠不一致・画像の失敗などを区別し、未生成なのに保存済みコマとは案内しない', () => {
  assert.match(comicFailureMessage('UNGROUNDED', false), /原文の根拠/);
  assert.ok(!comicFailureMessage('UNGROUNDED', false).includes('保存済みのコマ'));
  assert.match(comicFailureMessage('AUTH', false), /接続/);
  assert.match(comicFailureMessage('FAILED', true, 2), /2コマ/);
  assert.match(comicFailureMessage('FAILED', false), /紹介内容/);
});
test('実APIの脚本スキーマは引用候補IDを列挙し、選択から原文引用を復元する', async () => {
  let sent;
  const provider = createBookArtifactProvider({ apiKey: 'test-private-key', fetcher: async (url, init) => {
    sent = JSON.parse(init.body); const source = JSON.parse(sent.input).sources[0];
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ cast: script.cast, panels: script.panels.map(({ quote, ...panel }) => ({ ...panel, sourceId: source.id })) }) }] }] });
  } });
  const result = await provider.script({ title: '物語', opening: text, context: text + 'この先は未紹介。' });
  const fields = sent.text.format.schema.properties.panels.items.properties;
  assert.equal(fields.quote, undefined); assert.ok(fields.sourceId.enum.includes('s1'));
  assert.equal(result.panels[0].quote, text); assert.ok(!result.panels[0].quote.includes('未紹介'));
});
test('相関図は同じ段落・サロゲートペアも含め、しおり直後の未読文を切り落とす', () => {
  const full = text + '😀花子の正体は王女だった。';
  assert.equal(textToBookmark(full, [{ id: 'mark', offset: text.length }], 'mark'), text);
  assert.throws(() => textToBookmark(full, [{ id: 'mark', offset: text.length + 1 }], 'mark'));
  assert.throws(() => textToBookmark(full, [], 'mark'));
});
test('人物名・関係名・両者を含む引用が原文に実在する項目だけを表示する', () => {
  const verified = groundedGraph({ ...graph, people: [...graph.people, { id: 'c', name: '王女', quote: '花子の正体は王女だった。' }], relations: [...graph.relations, { from: 'a', to: 'b', label: '兄妹', quote }, { from: 'a', to: 'c', label: '王女', quote }] }, text);
  assert.equal(verified.people.length, 2); assert.equal(verified.relations.length, 1);
  assert.equal(text.slice(verified.relations[0].start, verified.relations[0].end), quote);
  assert.throws(() => groundedGraph({ people: [{ id: 'a', name: '王女', quote: '王女が来た。' }], relations: [] }, text), /UNGROUNDED/);
  assert.deepEqual(groundedGraph({ people: [], relations: [] }, text), { people: [], relations: [] });
});
test('紹介は複数場面を読み、紹介範囲と理解用本文を分けて脚本の原文引用を検証する', () => {
  const source = introSource('冒頭。'.repeat(100) + 'メロスは、すぐに出発した。' + '後半。'.repeat(400), '走れメロス');
  assert.ok(source.opening.endsWith('メロスは、すぐに出発した。')); assert.ok(source.context.startsWith(source.opening));
  assert.ok(source.opening.length <= 12000); assert.ok(source.context.length <= 20000);
  assert.equal(validateScript(script, text).panels.length, 4);
  assert.throws(() => validateScript({ ...script, panels: script.panels.slice(0, 3) }, text));
  assert.throws(() => validateScript(script, '未読の別の本文'), /UNGROUNDED/);
});
test('相関図は本文だけを受け取り、同時要求・再起動でも保存を再利用する', async t => {
  const root = await temporary(t); let calls = 0, received;
  const endpoint = createCharactersEndpoint({ root, provider: { ...fake, characters: async value => { calls++; received = value; return graph; } } });
  const results = await Promise.all([endpoint(post({ text })), endpoint(post({ text }))]);
  assert.ok(results.every(response => response.ok)); assert.equal(calls, 1); assert.equal(received, text);
  const restarted = createCharactersEndpoint({ root, provider: { ...fake, characters: async () => { throw new Error('MUST_NOT_GENERATE'); } } });
  assert.equal((await restarted(post({ text }))).status, 200);
  assert.equal((await endpoint(post({ text, title: '作品名' }))).status, 400);
  assert.equal((await endpoint(post({ text: '字'.repeat(100001) }))).status, 400); assert.equal(calls, 1);
});
test('別のしおり本文に以前の図を流用せず、根拠不一致の結果は保存しない', async t => {
  const root = await temporary(t); let calls = 0;
  const endpoint = createCharactersEndpoint({ root, provider: { ...fake, characters: async () => { calls++; return graph; } } });
  assert.equal((await endpoint(post({ text }))).status, 200);
  assert.equal((await endpoint(post({ text: '未読の別の本文' }))).status, 503);
  assert.equal((await endpoint(post({ text: '未読の別の本文' }))).status, 503); assert.equal(calls, 3);
});
test('漫画は登録・状態照会では生成せず、1回の開始から脚本と4枚を順に保存する', async t => {
  const root = await temporary(t); let scripts = 0; const images = [];
  const endpoint = createComicEndpoint({ root, provider: { ...fake, script: async () => { scripts++; return script; }, image: async (value, index, reference) => { images.push({ index, reference }); return png; } } });
  const initial = await register(endpoint); assert.equal(initial.status, 'idle'); assert.equal(scripts, 0);
  const starts = await Promise.all(Array.from({ length: 3 }, () => endpoint(post({ action: 'start', key: initial.key }))));
  assert.ok(starts.every(response => response.status === 202));
  const ready = await finished(endpoint, initial.key); assert.equal(ready.completed, 4); assert.equal(ready.status, 'ready'); assert.equal(scripts, 1);
  assert.equal(images.length, 4); assert.equal(images[0].reference, null); assert.ok(images.slice(1).every(image => image.reference === png));
  const image = await endpoint(new Request(`http://localhost/api/comic?key=${initial.key}&image=1`)); assert.equal(image.headers.get('content-type'), 'image/png');
  const restarted = createComicEndpoint({ root, provider: { ...fake, script: async () => { throw new Error('MUST_NOT_GENERATE'); } } });
  assert.equal((await register(restarted)).status, 'ready'); assert.equal((await restarted(post({ action: 'start', key: initial.key }))).status, 200);
});
test('漫画の途中失敗は脚本と完成コマを残し、別プロセス相当の再開で残りだけ作る', async t => {
  const root = await temporary(t); const first = [];
  const endpoint = createComicEndpoint({ root, provider: { ...fake, image: async (value, index) => { first.push(index); if (index === 1) throw new Error('AUTH secret-private'); return png; } } });
  const { key } = await register(endpoint); await endpoint(post({ action: 'start', key }));
  const failed = await finished(endpoint, key); assert.equal(failed.completed, 1, JSON.stringify(failed)); assert.equal(failed.status, 'error'); assert.ok(!JSON.stringify(failed).includes('secret-private'));
  const resumed = [];
  const restarted = createComicEndpoint({ root, provider: { ...fake, script: async () => { throw new Error('MUST_NOT_GENERATE'); }, image: async (value, index) => { resumed.push(index); return png; } } });
  await restarted(post({ action: 'start', key })); const completed = await finished(restarted, key); assert.equal(completed.status, 'ready', JSON.stringify(completed)); assert.deepEqual(resumed, [1, 2, 3]);
});
test('原文引用の不一致で止まった既存記録は、候補ID方式で削除や回数リセットなしに再開できる', async t => {
  const root = await temporary(t);
  const old = createComicEndpoint({ root, provider: { ...fake, script: async () => ({ ...script, panels: script.panels.map(panel => ({ ...panel, quote: '太郎と花子は友達でした。' })) }) } });
  const { key } = await register(old); await old(post({ action: 'start', key }));
  const failed = await finished(old, key); assert.equal(failed.failure.code, 'UNGROUNDED'); assert.equal(failed.completed, 0);
  const fixed = createComicEndpoint({ root, provider: { ...fake, script: async source => scriptFromPassages({ cast: script.cast, panels: script.panels.map(panel => ({ ...panel, sourceId: 's1' })) }, source.opening) } });
  await fixed(post({ action: 'start', key })); assert.equal((await finished(fixed, key)).status, 'ready');
  const saved = await artifactStorage(root).read(key); assert.equal(saved.scriptAttempts, 2); assert.equal(saved.imageAttempts, 4);
});
test('保存画像だけが先に残った場合も回収し、二重生成しない。回数上限は永続化する', async t => {
  const root = await temporary(t), endpoint = createComicEndpoint({ root, provider: fake });
  const { key } = await register(endpoint), storage = artifactStorage(root);
  await storage.write(key, Buffer.from(png, 'base64'), '1.png');
  await storage.update(key, value => ({ ...value, script: validateScript(script, text), imageAttempts: 8, status: 'running' }));
  const interrupted = await (await endpoint(status(key))).json(); assert.equal(interrupted.failure.code, 'INTERRUPTED');
  await endpoint(post({ action: 'start', key })); const value = await finished(endpoint, key);
  assert.equal(value.completed, 1); assert.equal(value.failure.code, 'LIMIT');
});
test('上限到達後は明示した場合だけ未完成1コマ分を追加し、既存3枚を作り直さない', async t => {
  const root = await temporary(t), made = [];
  const endpoint = createComicEndpoint({ root, provider: { ...fake, image: async (script, index) => { made.push(index); return png; } } });
  const { key } = await register(endpoint), storage = artifactStorage(root);
  for (const index of [1, 2, 3]) await storage.write(key, Buffer.from(png, 'base64'), `${index}.png`);
  await storage.update(key, value => ({ ...value, script: validateScript(script, text), completed: 3, imageAttempts: 8, status: 'error', error: { code: 'LIMIT' } }));
  assert.equal((await (await endpoint(status(key))).json()).canResumeRemaining, true);
  await endpoint(post({ action: 'start', key })); assert.equal((await finished(endpoint, key)).failure.code, 'LIMIT'); assert.deepEqual(made, []);
  await endpoint(post({ action: 'start', key, resumeRemaining: true })); assert.equal((await finished(endpoint, key)).status, 'ready');
  assert.deepEqual(made, [3]); const saved = await storage.read(key); assert.equal(saved.imageAttempts, 9); assert.equal(saved.imageLimit, 9);
});
test('APIモジュール相当の再作成でも同じプロセスの進行中ジョブを共有する', async t => {
  const root = await temporary(t); let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const first = createComicEndpoint({ root, provider: { ...fake, script: async () => { calls++; await gate; return script; } } });
  const { key } = await register(first); await first(post({ action: 'start', key }));
  const reloaded = createComicEndpoint({ root, provider: { ...fake, script: async () => { throw new Error('DUPLICATE_JOB'); } } });
  assert.equal((await (await reloaded(status(key))).json()).status, 'running');
  await reloaded(post({ action: 'start', key })); release();
  assert.equal((await finished(reloaded, key)).status, 'ready'); assert.equal(calls, 1);
});
test('不正なOrigin・パス・過大な入力を拒否し、秘密のエラー本文を返さない', async t => {
  const root = await temporary(t), endpoint = createComicEndpoint({ root, provider: fake });
  const request = post({ action: 'register' }); request.headers.set('origin', 'https://outside.example');
  assert.equal((await endpoint(request)).status, 403);
  assert.equal((await endpoint(post({ action: 'register', bookId: 'book', title: '題', opening: text, context: '別の内容' }))).status, 400);
  const invalid = await (await endpoint(status('../../secret'))).json(); assert.equal(invalid.code, 'INVALID_INPUT');
  const missing = createCharactersEndpoint({ root, provider: { ...fake, configured: false } });
  assert.equal((await (await missing(post({ text }))).json()).code, 'NOT_CONFIGURED');
});
test('実APIへの文字要求はStructured Outputsと保存なし、画像要求は固定モデルと参考画像を使う', async () => {
  const requests = [];
  const provider = createBookArtifactProvider({ apiKey: 'test-private-key', fetcher: async (url, init) => {
    requests.push({ url, init });
    return Response.json(url.endsWith('responses') ? { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(graph) }] }] } : { data: [{ b64_json: png }] });
  } });
  await provider.characters(text); const body = JSON.parse(requests[0].init.body);
  assert.equal(body.input, text); assert.equal(body.store, false); assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.tools, undefined);
  await provider.image(script, 0, null); await provider.image(script, 1, png);
  assert.ok(requests[1].url.endsWith('images/generations')); assert.ok(requests[2].url.endsWith('images/edits'));
  assert.ok(requests[2].init.body instanceof FormData); assert.equal(requests[2].init.body.get('input_fidelity'), 'high');
  let called = false;
  const absent = createBookArtifactProvider({ apiKey: '', fetcher: async () => { called = true; } });
  await assert.rejects(absent.characters(text), /NOT_CONFIGURED/); assert.equal(called, false);
});
