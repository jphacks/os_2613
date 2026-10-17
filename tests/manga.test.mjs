import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { dialogueEvidence, scriptFromPassages, validateScript } from '../src/features/comic/model.mjs';
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

test('句点のない発言全体と引用符付きの脚本を原文へ照合し、切れた文は除く', () => {
  const text = '私は「愉快ですね」と言った。先生は「もう帰りませんか」と答えた。';
  assert.equal(dialogueEvidence(text, '「愉快ですね」').quote, '愉快ですね');
  assert.equal(dialogueEvidence(text, 'もう帰りませんか').quote, 'もう帰りませんか');
  assert.equal(dialogueEvidence(text, '愉快です'), null);
  assert.equal(dialogueEvidence('「ただ、私に情をかけたいつもりなら、」', 'ただ、私に情をかけたいつもりなら、'), null);
});

test('画像通信・応答エラーを区別し、保存済み案の会話を課金なしで戻して試行上限を守る', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dopabooks-page-error-test-'));
  t.after(async () => { if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw Error('Invalid temporary root'); await rm(root, { recursive: true, force: true }); });
  let scripts = 0, images = 0;
  const text = opening + '私は「愉快ですね」と言った。';
  const candidate = structuredClone(value);
  for (const panel of candidate.panels) {
    const narration = panel.balloons.pop(); panel.narration = { text: narration.text, sourceId: narration.sourceId };
    panel.balloons = [{ kind: 'speech', slot: 'right', speaker: '私', text: '「愉快ですね」', sourceId: 's1' }];
  }
  const provider = createBookArtifactProvider({ apiKey: 'fake-only', fetcher: async (url, init) => {
    if (url.endsWith('/responses')) {
      scripts++; const schema = JSON.parse(init.body).text.format.schema;
      assert.equal(schema.properties.cast.maxLength, 600);
      assert.equal(schema.properties.panels.items.properties.scene.maxLength, 240);
      return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(candidate) }] }] });
    }
    images++;
    if (images === 1) throw new TypeError('private-error-message', { cause: { code: 'UND_ERR_HEADERS_TIMEOUT' } });
    if (images === 2) return new Response('not-json', { headers: { 'Content-Type': 'application/json' } });
    return Response.json({ data: [{ b64_json: png }] });
  } });
  const endpoint = createComicEndpoint({ root, provider });
  const registered = await (await endpoint(post({ action: 'register', bookId: 'errors', title: '物語', opening: text, context: text, edition: 'manga', revision: 5 }))).json();
  async function run(extra = {}) {
    await endpoint(post({ action: 'start', key: registered.key, ...extra }));
    for (let i = 0; i < 100; i++) {
      const state = await (await endpoint(new Request(`http://localhost/api/comic?key=${registered.key}`))).json();
      if (state.status !== 'running') return state;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw Error('Not finished');
  }
  const failed = await run();
  assert.equal(failed.failure.code, 'TIMEOUT'); assert.equal(failed.failureStage, 'image');
  const storage = artifactStorage(root);
  let record = await storage.read(registered.key);
  assert.equal(record.providerDiagnostic.code, 'UND_ERR_HEADERS_TIMEOUT');
  assert.ok(!JSON.stringify(record).includes('private-error-message'));
  // 以前の検査で会話が落ちた保存脚本を再現する。
  await storage.update(registered.key, r => ({ ...r, script: { ...r.script, panels: r.script.panels.map(p => ({ ...p, balloons: p.balloons.filter(b => b.kind === 'narration') })) } }));
  const second = await run(); assert.equal(second.failure.code, 'RESPONSE_INVALID');
  assert.ok(second.script.panels[0].balloons.some(b => b.text === '愉快ですね'));
  assert.equal(scripts, 1); assert.equal(images, 2); assert.equal(second.canResumeRemaining, true);
  const limited = await run(); assert.equal(limited.failure.code, 'LIMIT'); assert.equal(images, 2);
  const ready = await run({ resumeRemaining: true });
  assert.equal(ready.status, 'ready'); assert.equal(ready.completed, 1);
  assert.equal(scripts, 1); assert.equal(images, 3);
});

test('1ページ版は脚本と文字をまとめてhigh品質1枚にし、保存後は再生成しない', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dopabooks-page-test-'));
  t.after(async () => { if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw Error('Invalid temporary root'); await rm(root, { recursive: true, force: true }); });
  const requests = [];
  const provider = createBookArtifactProvider({ apiKey: 'fake-only', fetcher: async (url, init) => {
    requests.push({ url, init });
    return Response.json(url.endsWith('/responses') ? { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] } : { data: [{ b64_json: png }] });
  } });
  const endpoint = createComicEndpoint({ root, provider });
  const register = async revision => (await endpoint(post({ action: 'register', bookId: 'page', title: '物語', opening, context: opening, edition: 'manga', revision }))).json();
  const old = await register(4), page = await register(5);
  assert.notEqual(old.key, page.key); assert.equal(page.totalImages, 1);
  await endpoint(post({ action: 'start', key: page.key }));
  let ready;
  for (let i = 0; i < 100; i++) {
    ready = await (await endpoint(new Request(`http://localhost/api/comic?key=${page.key}`))).json();
    if (ready.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(ready.status, 'ready'); assert.equal(ready.completed, 1);
  assert.equal(ready.script.generation.revision, 5); assert.equal(ready.script.generation.imageModel, 'gpt-image-1.5');
  assert.equal(requests.length, 2);
  const form = requests[1].init.body;
  assert.equal(form.get('model'), 'gpt-image-1.5'); assert.equal(form.get('quality'), 'high');
  assert.equal(form.get('n'), '1'); assert.equal(form.get('size'), '1024x1536');
  assert.equal(form.getAll('image[]').length, 1);
  assert.match(form.get('prompt'), /ONE COMPLETE/); assert.match(form.get('prompt'), /明日、橋で会おう。/);
  assert.match(form.get('prompt'), /EXACTLY/); assert.ok(!form.get('prompt').includes('NO text'));
  assert.ok(!JSON.parse(requests[0].init.body).instructions.includes('別工程で組版'));
  const image = await endpoint(new Request(`http://localhost/api/comic?key=${page.key}&image=1`));
  assert.equal(image.headers.get('Content-Type'), 'image/png');
  assert.equal((await endpoint(new Request(`http://localhost/api/comic?key=${page.key}&image=2`))).status, 503);
  await register(5); await endpoint(post({ action: 'start', key: page.key }));
  assert.equal(requests.length, 2);
  assert.equal((await register(4)).completed, 0);
  await assert.rejects(provider.image(ready.script, 1, null), /INVALID_INPUT/);
});

test('新しい1.5版はMini版と保存先を分け、話者配置を画像へ伝える', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dopabooks-edition-test-'));
  t.after(async () => { if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw Error('Invalid temporary root'); await rm(root, { recursive: true, force: true }); });
  const requests = [];
  const provider = createBookArtifactProvider({ apiKey: 'fake-only', fetcher: async (url, init) => {
    requests.push({ url, init });
    return Response.json(url.endsWith('/responses') ? { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] } : { data: [{ b64_json: png }] });
  } });
  const endpoint = createComicEndpoint({ root, provider });
  const register = async revision => (await endpoint(post({ action: 'register', bookId: 'compare', title: '物語', opening, context: opening, edition: 'manga', revision }))).json();
  const old = await register(3), next = await register(4);
  assert.notEqual(old.key, next.key);
  assert.equal((await register(3)).key, old.key);
  const script = await provider.script({ title: '物語', opening, context: opening, format: 'manga-v2', revision: 4 });
  assert.equal(validateScript(script, opening).generation.imageModel, 'gpt-image-1.5');
  await provider.image(script, 1, png);
  const form = requests[1].init.body;
  assert.equal(form.get('model'), 'gpt-image-1.5');
  assert.equal(form.get('quality'), 'medium');
  assert.match(form.get('prompt'), /right: 太郎/);
  assert.match(form.get('prompt'), /left: 花子/);
  assert.match(form.get('prompt'), /Never copy the first panel cast/);
  assert.match(form.get('prompt'), /Speaker placement takes priority/);
  assert.equal(form.getAll('image[]').length, 2);
});

test('生成サービスの形式拒否は固定コードで識別し、任意のエラー本文を記録しない', async () => {
  const provider = createBookArtifactProvider({ apiKey: 'fake-only', fetcher: async () => Response.json({ error: { code: 'invalid_json_schema', param: 'text.format.schema', message: 'private-error-body' } }, { status: 400 }) });
  await assert.rejects(provider.script({ title: '物語', opening, context: opening, format: 'manga-v2', revision: 3 }), error => {
    assert.equal(error.message, 'PROVIDER_INPUT');
    assert.deepEqual(error.diagnostic, { status: 400, code: 'invalid_json_schema', param: 'text.format.schema' });
    assert.ok(!JSON.stringify(error).includes('private-error-body')); return true;
  });
});

test('脚本の検査で失敗しても案を保存し、次の手動開始ではその案を修正して画像へ進む', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dopabooks-draft-test-'));
  t.after(async () => { if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw Error('Invalid temporary root'); await rm(root, { recursive: true, force: true }); });
  let calls = 0; const bodies = [];
  const provider = createBookArtifactProvider({ apiKey: 'fake-only', fetcher: async (url, init) => {
    if (!url.endsWith('/responses')) return Response.json({ data: [{ b64_json: png }] });
    bodies.push(JSON.parse(init.body)); calls++;
    const candidate = structuredClone(value);
    for (const panel of candidate.panels) {
      const narration = panel.balloons.pop(); panel.narration = { text: narration.text, sourceId: narration.sourceId };
    }
    if (calls === 1) candidate.cast = '長'.repeat(1601);
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(candidate) }] }] });
  } });
  const endpoint = createComicEndpoint({ root, provider });
  const registered = await (await endpoint(post({ action: 'register', bookId: 'draft', title: '物語', opening, context: opening, edition: 'manga', revision: 3 }))).json();
  async function run() {
    await endpoint(post({ action: 'start', key: registered.key }));
    for (let i = 0; i < 100; i++) {
      const state = await (await endpoint(new Request(`http://localhost/api/comic?key=${registered.key}`))).json();
      if (state.status !== 'running') return state;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw Error('Not completed');
  }
  const failed = await run();
  assert.equal(failed.failure.code, 'INVALID_RESULT'); assert.equal(failed.hasScriptDraft, true);
  assert.equal(failed.completed, 0); assert.equal(calls, 1);
  assert.equal((await artifactStorage(root).read(registered.key)).scriptDraft.cast.length, 1601);
  const ready = await run(); assert.equal(ready.status, 'ready'); assert.equal(ready.completed, 4); assert.equal(calls, 2);
  const input = JSON.parse(bodies[1].input);
  assert.equal(input.repairDraft.cast.length, 1601); assert.equal(input.opening, undefined); assert.equal(input.context, undefined);
  assert.equal(bodies[1].reasoning.effort, 'none');
  assert.equal(bodies[1].text.format.schema.properties.cast.maxLength, 1200);
});

test('修正版は地の文を会話にせず、読点で途切れる発言や文中の切り抜きを除く', () => {
  const text = '首を振って答えなかった。無言で首肯き、うなずいた。「ただ、私に情をかけたいつもりなら、三日待ってくれ。」';
  assert.equal(dialogueEvidence(text, '首を振って答えなかった。'), null);
  assert.equal(dialogueEvidence(text, '無言で首肯き'), null);
  assert.equal(dialogueEvidence(text, 'ただ、私に情をかけたいつもりなら、'), null);
  assert.equal(dialogueEvidence(text, '三日待ってくれ。'), null);
  assert.ok(dialogueEvidence(text, 'ただ、私に情をかけたいつもりなら、三日待ってくれ。'));
  const copy = structuredClone(value);
  copy.panels[0].balloons[0].text = 'と言った。';
  const script = scriptFromPassages(copy, opening, { recoverBalloons: true, editorial: true });
  assert.equal(script.panels[0].balloons.length, 2);
  assert.ok(script.panels[0].balloons.some(item => item.kind === 'narration'));
});

test('修正版の脚本をGPT-5.4へ上げ、必須説明枠とMini画像のモデル記録を確認する', async () => {
  let candidate = structuredClone(value); const requests = [];
  for (const panel of candidate.panels) {
    const narration = panel.balloons.pop();
    panel.narration = { text: narration.text, sourceId: narration.sourceId };
  }
  const provider = createBookArtifactProvider({ apiKey: 'fake-only', fetcher: async (url, init) => {
    requests.push({ url, init });
    return Response.json(url.endsWith('/responses') ? { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(candidate) }] }] } : { data: [{ b64_json: png }] });
  } });
  const script = await provider.script({ title: '物語', opening, context: opening, format: 'manga-v2', revision: 3 });
  assert.equal(JSON.parse(requests[0].init.body).model, 'gpt-5.4');
  assert.equal(JSON.parse(requests[0].init.body).reasoning.effort, 'none');
  assert.ok(JSON.parse(requests[0].init.body).text.format.schema.properties.panels.items.required.includes('narration'));
  assert.deepEqual(validateScript(script, opening), script);
  assert.equal(script.generation.textModel, 'gpt-5.4');
  assert.equal(script.generation.imageModel, 'gpt-image-1-mini');
  await provider.image(script, 0, null);
  assert.equal(requests[1].init.body.get('model'), 'gpt-image-1-mini');
  assert.equal(requests[1].init.body.get('quality'), 'medium');
  assert.equal(requests[1].init.body.get('input_fidelity'), null);
  const instructions = JSON.parse(requests[0].init.body).instructions;
  assert.match(instructions, /地の文/); assert.match(instructions, /人質/); assert.match(instructions, /王冠/);
  // captionにだけ要点があっても、表示文に期限・人質がなければ画像生成へ進まない。
  await assert.rejects(provider.script({ title: '走れメロス', opening: opening + '三日、友を人質にした。', context: opening + '三日、友を人質にした。', format: 'manga-v2', revision: 3 }), /STORY_INCOMPLETE/);
  candidate = structuredClone(value);
  for (const panel of candidate.panels) panel.balloons[2].text = '友を人質に残し、三日以内に戻る約束をした。';
  const plot = await provider.script({ title: '走れメロス', opening: opening + '三日、友を人質にした。', context: opening + '三日、友を人質にした。', format: 'manga-v2', revision: 3 });
  assert.equal(plot.panels[2].balloons[2].text, candidate.panels[2].balloons[2].text);
  for (const panel of candidate.panels) panel.balloons[2].text = '友を身代わりに残し、３日以内に帰る。';
  const alternate = await provider.script({ title: '走れメロス', opening: opening + '三日、友を人質にした。', context: opening + '三日、友を人質にした。', format: 'manga-v2', revision: 3 });
  assert.equal(alternate.generation.textModel, 'gpt-5.4');
});

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

test('会話の言い換えは除き、照合済み説明を残す。全件不一致なら原文の説明枠で続行する', () => {
  const copy = structuredClone(value);
  copy.panels[0].balloons[0].text = '明日橋で会おう！';
  const result = scriptFromPassages(copy, opening, { recoverBalloons: true });
  assert.equal(result.panels[0].balloons.length, 2);
  assert.equal(result.panels[0].balloons[0].text, '約束ね。');
  copy.panels[0].balloons = [copy.panels[0].balloons[0]];
  const fallback = scriptFromPassages(copy, opening, { recoverBalloons: true });
  assert.equal(fallback.panels[0].balloons[0].kind, 'narration');
  assert.ok(opening.includes(fallback.panels[0].balloons[0].text));
  assert.ok(!JSON.stringify(fallback).includes('明日橋で会おう！'));
  assert.deepEqual(validateScript(fallback, opening), fallback);
  copy.panels[0].balloons[0].sourceId = 'future';
  assert.throws(() => scriptFromPassages(copy, opening, { recoverBalloons: true }), /UNGROUNDED/);
});

test('会話が別の資料へ誤って紐付いても、紹介範囲の実在する文へ位置を復元する', () => {
  const text = 'あ'.repeat(180) + opening;
  const copy = structuredClone(value);
  const script = scriptFromPassages(copy, text, { recoverBalloons: true });
  assert.equal(script.panels[0].balloons[0].start, text.indexOf('明日、橋で会おう。'));
  assert.deepEqual(validateScript(script, text), script);
});

test('漫画版は文字入り画像を要求せず、絵柄の見本と作品の1コマ目を役割別に渡す', async () => {
  const requests = [];
  const provider = createBookArtifactProvider({ apiKey: 'fake-only', fetcher: async (url, init) => {
    requests.push({ url, init });
    return Response.json(url.endsWith('/responses') ? { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] } : { data: [{ b64_json: png }] });
  } });
  const script = await provider.script({ title: '物語', opening, context: opening, format: 'manga-v2' });
  const body = JSON.parse(requests[0].init.body);
  assert.equal(body.model, 'gpt-5.4'); assert.equal(body.text.format.name, 'manga_introduction');
  assert.equal(body.max_output_tokens, 12000); assert.equal(body.store, false);
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
  const revised = await (await endpoint(post({ ...input, edition: 'manga', revision: 3 }))).json();
  assert.notEqual(revised.key, manga.key); assert.equal(revised.status, 'idle');
  assert.equal((await artifactStorage(root).read(revised.key)).source.revision, 3);
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
  const saved = await artifactStorage(root).read(manga.key);
  await artifactStorage(root).write(manga.key, { ...saved, script: null, completed: 0, scriptAttempts: 3, status: 'error', error: { code: 'UNGROUNDED' } });
  // 完成画像は残す。修正版脚本の明示した再試行だけを許し、画像は回収する。
  await endpoint(post({ action: 'start', key: manga.key }));
  for (let i = 0; i < 60; i++) {
    state = await (await endpoint(new Request(`http://localhost/api/comic?key=${manga.key}`))).json();
    if (state.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(state.status, 'ready'); assert.equal(scripts, 2); assert.equal(images, 4);
  const recovered = await artifactStorage(root).read(manga.key);
  assert.equal(recovered.scriptAttempts, 4); assert.equal(recovered.balloonRecoveryTried, true);
  await artifactStorage(root).write(manga.key, { ...recovered, script: null, status: 'error', error: { code: 'UNGROUNDED' } });
  await endpoint(post({ action: 'start', key: manga.key }));
  for (let i = 0; i < 60; i++) {
    state = await (await endpoint(new Request(`http://localhost/api/comic?key=${manga.key}`))).json();
    if (state.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(state.failure.code, 'LIMIT'); assert.equal(scripts, 2);
  assert.equal(state.canResumeScript, true);
  const before = await artifactStorage(root).read(manga.key);
  await endpoint(post({ ...input, edition: 'manga' }));
  assert.equal((await artifactStorage(root).read(manga.key)).scriptLimit, before.scriptLimit);
  await endpoint(post({ action: 'start', key: manga.key, resumeScript: true }));
  for (let i = 0; i < 60; i++) {
    state = await (await endpoint(new Request(`http://localhost/api/comic?key=${manga.key}`))).json();
    if (state.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const retried = await artifactStorage(root).read(manga.key);
  assert.equal(state.status, 'ready'); assert.equal(state.canResumeScript, false);
  assert.equal(retried.scriptLimit, before.scriptAttempts + 1);
  assert.equal(retried.scriptAttempts, before.scriptAttempts + 1);
  assert.equal(scripts, 3); assert.equal(images, 4);
});
