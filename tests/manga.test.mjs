import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { scriptFromPassages, validateScript } from '../src/features/comic/model.mjs';
import { createBookArtifactProvider } from '../src/server/book-artifact-provider.mjs';
import { createComicEndpoint } from '../src/server/book-artifacts.mjs';
import { artifactStorage } from '../src/server/artifact-storage.mjs';

const opening = '太郎は花子に「明日、橋で会おう。」と言った。花子は「約束ね。」と答えた。';
const value = { format: 'manga-v2', cast: '太郎は短髪、花子は帽子をかぶる。', panels: Array.from({ length: 4 }, (_, index) => ({
  title: `場面${index + 1}`, caption: '太郎と花子が橋で会う約束をする。', scene: '二人の表情を描く。', sourceId: 's1',
  balloons: [
    { kind: 'speech', slot: 'right', speaker: '太郎', text: '明日、橋で会おう。', sourceId: 's1' },
    { kind: 'speech', slot: 'left', speaker: '花子', text: '約束ね。', sourceId: 's1' },
    { kind: 'narration', slot: 'bottom', speaker: '', text: '二人は再会を約束した。', sourceId: 's1' },
  ],
})) };
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5XkAAAAASUVORK5CYII=';
const post = body => new Request('http://localhost/api/comic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('吹き出しは先に原文へ照合し、絵とは別の正確な文字列で保存する', () => {
  const script = scriptFromPassages(value, opening);
  assert.equal(script.format, 'manga-v2'); assert.equal(script.panels[0].balloons[0].text, '明日、橋で会おう。');
  assert.deepEqual(validateScript(JSON.parse(JSON.stringify(script)), opening), script);
  for (const panel of script.panels) for (const balloon of panel.balloons) assert.equal(opening.slice(balloon.start, balloon.end), balloon.quote);
  const changed = change => { const copy = structuredClone(value); change(copy.panels[0].balloons); return copy; };
  assert.throws(() => scriptFromPassages(changed(items => { items[0].text = '結末は大勝利だ。'; }), opening), /UNGROUNDED/);
  assert.throws(() => scriptFromPassages(changed(items => { items[0].sourceId = 'future'; }), opening), /UNGROUNDED/);
  assert.throws(() => scriptFromPassages(changed(items => { items[1].slot = 'right'; }), opening), /INVALID_RESULT/);
  assert.throws(() => scriptFromPassages(changed(items => { items[0].text = 'あ'.repeat(33); }), opening), /INVALID_RESULT/);
  assert.throws(() => scriptFromPassages(changed(items => { items[2].slot = 'left'; }), opening), /INVALID_RESULT/);
});

test('漫画版は文字入り画像を要求せず、絵柄の見本と作品の1コマ目を役割別に渡す', async () => {
  const requests = [];
  const provider = createBookArtifactProvider({ apiKey: 'fake-only', fetcher: async (url, init) => {
    requests.push({ url, init });
    return Response.json(url.endsWith('/responses') ? { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] } : { data: [{ b64_json: png }] });
  } });
  const script = await provider.script({ title: '物語', opening, context: opening, format: 'manga-v2' });
  const body = JSON.parse(requests[0].init.body);
  assert.equal(body.model, 'gpt-5.4-mini'); assert.equal(body.text.format.name, 'manga_introduction');
  assert.equal(body.max_output_tokens, 10000); assert.equal(body.store, false);
  assert.equal(JSON.parse(body.input).sources[0].text, opening);
  assert.ok(body.text.format.schema.properties.panels.items.properties.balloons);
  await provider.image(script, 0, null); await provider.image(script, 1, png);
  for (const request of requests.slice(1)) {
    assert.ok(request.url.endsWith('/images/edits'));
    assert.equal(request.init.body.get('quality'), 'medium'); assert.equal(request.init.body.get('size'), '1024x1536');
    assert.ok(request.init.body.get('prompt').includes('NO text'));
    assert.ok(request.init.body.get('prompt').includes('ignore ALL its text, story, people'));
  }
  assert.equal(requests[1].init.body.getAll('image[]').length, 1);
  assert.equal(requests[2].init.body.getAll('image[]').length, 2);
  assert.equal(requests[1].init.body.get('image[]').name, 'style-only.png');
  assert.equal(requests[2].init.body.getAll('image[]')[1].name, 'story-first-panel.png');
});

test('漫画版の新規保存は旧版を上書きせず、吹き出し付き脚本を保存・再利用する', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dopabooks-manga-test-'));
  t.after(async () => { if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw Error('Invalid temporary root'); await rm(root, { recursive: true, force: true }); });
  let scripts = 0, images = 0;
  const endpoint = createComicEndpoint({ root, provider: {
    script: async source => { scripts++; assert.equal(source.format, 'manga-v2'); return scriptFromPassages(value, source.opening); },
    image: async () => { images++; return png; },
  } });
  const input = { action: 'register', bookId: 'book', title: '物語', opening, context: opening };
  const original = await (await endpoint(post(input))).json();
  const manga = await (await endpoint(post({ ...input, edition: 'manga' }))).json();
  assert.notEqual(manga.key, original.key); assert.equal(manga.status, 'idle'); assert.equal(scripts, 0);
  await endpoint(post({ action: 'start', key: manga.key }));
  let state;
  for (let i = 0; i < 60; i++) {
    state = await (await endpoint(new Request(`http://localhost/api/comic?key=${manga.key}`))).json();
    if (state.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(state.status, 'ready'); assert.equal(state.script.format, 'manga-v2');
  assert.equal(state.script.panels[0].balloons.length, 3);
  assert.equal((await (await endpoint(post({ ...input, edition: 'manga' }))).json()).status, 'ready');
  assert.equal(scripts, 1); assert.equal(images, 4);
  assert.equal((await artifactStorage(root).read(original.key)).script, null);
});
