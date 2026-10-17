import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { artifactStorage, artifactKey } from '../src/server/artifact-storage.mjs';
import { studyUnits, validateLesson, createStudyService, createStudyEndpoint, createStudyProvider } from '../src/server/study.mjs';

const source = { id: 'calculus', hash: 'original-pdf-hash', pages: [{ page: 1, text: '関数とは入力に対して出力を対応させる規則です。'.repeat(180) }, { page: 2, text: '微分は変化の割合を考えます。'.repeat(180) }],
  chapters: [{ index: 0, firstPage: 1, lastPage: 1, title: '第1章 関数' }, { index: 1, firstPage: 2, lastPage: 2, title: '第2章 微分' }] };
const reply = value => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(typeof value.beginner === 'string' ? { beginnerVisuals: [], standardVisuals: [], ...value } : value) }] }], usage: { input_tokens: 10, output_tokens: 10 } });

test('長すぎる保存済み引用は原文で照合して短く戻し、教材本文は変更しない', () => {
  const text = 'この章では正数の複素数冪を扱い、まず重要な定義とその条件を順に確かめます。' + '正数の複素数冪について、定義とその条件を説明します。'.repeat(30);
  const value = { title: '複素数冪', sourceQuote: text, beginner: '初級では具体例から定義と重要な条件を学習します。数値の意味を一つずつ確かめる説明です。', standard: '中級では指数法則と適用条件を原文と照らし合わせて詳しく確認します。理解確認も行います。' };
  const restored = validateLesson(value, { text });
  assert.ok(restored.sourceQuote.length <= 240); assert.ok(text.includes(restored.sourceQuote));
  assert.equal(restored.beginner, value.beginner); assert.equal(restored.standard, value.standard);
  const partlyReformatted = { ...value, sourceQuote: text.slice(0, 400) + '省略した式の表記' };
  const recovered = validateLesson(partlyReformatted, { text });
  assert.ok(text.includes(recovered.sourceQuote));
});

test('数式表記が整形された既存応答を一意な文章部分で復旧し、根拠は原文そのものに戻す', () => {
  const text = '命題   3.1.1   ( 指数関数 )   x   ∈   C   に対し次の級数は絶対収束する：\nexp x =\n∞ ∑\n0\nx n\nn !\n関数 x を指数関数と呼ぶ。';
  const value = { title: '指数関数', sourceQuote: '命題 3.1.1 (指数関数) x ∈ C に対し次の級数は絶対収束する： exp x = ∑∞₀ xⁿ/n!', beginner: '初級では重要な用語を具体例から順に学習していきます。定義の前提も確認しながら理解を進めます。', standard: '中級では定義の条件や適用範囲を詳しく学習します。原文での説明と対応させて理解を確かめます。' };
  const restored = validateLesson(value, { text });
  assert.ok(text.includes(restored.sourceQuote));
  assert.notEqual(restored.sourceQuote, value.sourceQuote);
  assert.equal(restored.beginner, value.beginner); assert.equal(restored.standard, value.standard);
  assert.throws(() => validateLesson({ ...value, sourceQuote: '原文に存在しない日本語の長い説明文から勝手に引用を作り上げたものです。' }, { text }), /UNGROUNDED/);
});
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'study-levels-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls = { outline: 0, lesson: 0 };
  const provider = {
    async outline() { calls.outline++; assert.fail('全体分析を呼ばない'); },
    async lesson(unit) { calls.lesson++; return reply({ title: '関数の理解', sourceQuote: unit.text.slice(0, 30), beginner: '入門として前提知識と具体例から重要な概念を一つずつ学びます。理解確認と解答を含む説明です。', standard: '標準では定義の条件と適用範囲を確認して原文の専門的な説明に進みます。応用と理解確認の説明です。' }); },
    ...options,
  };
  const make = (data = source) => createStudyService({ storage: artifactStorage(directory), provider, readSource: async () => data });
  return { directory, calls, make, service: make() };
}
test('全ページを欠落・重複なく区切り、サロゲートペアを切断しない', () => {
  const pages = [{ page: 1, text: 'あ'.repeat(5970) + '😀'.repeat(20) }, { page: 2, text: '次のページ' }];
  const units = studyUnits(pages);
  assert.equal(units.map(unit => unit.text).join(''), pages.map(page => `\n【原文 ${page.page}ページ】\n${page.text}\n`).join(''));
  assert.ok(units.every(unit => !/[\uD800-\uDBFF]$/.test(unit.text) && unit.text.length <= 6000));
  assert.equal(units.at(-1).lastPage, 2);
});
test('選んだ章の初級・中級だけを作成し、開く操作・章切替・再起動では再生成しない', async t => {
  const { service, calls, make } = await fixture(t);
  const initial = await service.status('calculus');
  assert.deepEqual(calls, { outline: 0, lesson: 0 }); assert.equal(initial.chapters.length, 2);
  const partial = await service.generate('calculus', 1);
  const chosen = partial.chapters[1], first = partial.units[chosen.units[0]];
  assert.ok(first.lesson.beginner); assert.ok(first.lesson.standard);
  assert.ok(partial.chapters[0].units.every(i => !partial.units[i].lesson));
  assert.equal(calls.outline, 0); assert.equal(calls.lesson, 1);
  const restarted = make(); let state = await restarted.status('calculus');
  assert.deepEqual(state, partial);
  while (!state.chapters[1].complete) state = await restarted.generate('calculus', 1);
  assert.equal(calls.lesson, chosen.units.length);
  const before = { ...calls }; await make().generate('calculus', 1); assert.deepEqual(calls, before);
});
test('同時の作成をまとめ、同じ単元への二重課金を防ぐ', async t => {
  const { service, calls } = await fixture(t);
  await Promise.all([service.generate('calculus', 0), service.generate('calculus', 0)]);
  assert.equal(calls.outline, 0);
  assert.equal(calls.lesson, 1);
});

test('挿絵は明示した範囲と難易度だけに作り、章や難易度の切替では生成しない', async t => {
  const { directory, service } = await fixture(t);
  await service.generate('calculus', 0);
  const calls = [];
  const reader = createStudyService({ storage: artifactStorage(directory), readSource: async () => source,
    illustrations: { read: async () => ({ complete: false, visuals: [] }), generate: async input => { calls.push(input); } } });
  await reader.status('calculus'); assert.equal(calls.length, 0);
  await reader.illustrate('calculus', 0, 0, 'beginner');
  assert.equal(calls.length, 1); assert.equal(calls[0].level, 'beginner');
  assert.ok(!calls[0].source.includes('微分は変化')); assert.ok(!('standard' in calls[0]));
  await assert.rejects(reader.illustrate('calculus', 1, 0, 'beginner'), /INVALID_INPUT/);
  await assert.rejects(reader.illustrate('calculus', 0, 0, 'original'), /INVALID_INPUT/);
  assert.equal(calls.length, 1);
});

test('保存済みの文章を再生成せず図解だけ明示的に追加して再利用する', async t => {
  let enrichCalls = 0;
  const { service, calls, make } = await fixture(t, {
    async lesson(unit) { calls.lesson++; return reply({ title: '関数', sourceQuote: unit.text.slice(0, 30), beginner: '初級の保存済み説明です。具体例から重要な定義の条件を一つずつ学び、理解を確かめます。', standard: '中級の保存済み説明です。原文で扱う定義と適用条件や応用について詳しく学びます。', beginnerVisuals: undefined, standardVisuals: undefined }); },
    async enrich(unit, lesson) { enrichCalls++; return reply({ beginnerVisuals: [{ kind: 'flow', after: '具体例から', title: '学ぶ順番', caption: '具体例から定義へ進みます。', graph: null, terms: [], nodes: [{ label: '具体例', detail: '身近な例を調べる' }, { label: '定義', detail: '意味を確かめる' }] }], standardVisuals: [] }); },
  });
  const base = await service.generate('calculus', 0);
  assert.equal(base.chapters[0].needsVisuals, true); assert.equal(enrichCalls, 0);
  await service.status('calculus'); assert.equal(enrichCalls, 0);
  const upgraded = await service.generate('calculus', 0);
  assert.equal(upgraded.chapters[0].complete, true); assert.equal(calls.lesson, 1); assert.equal(enrichCalls, 1);
  assert.equal(upgraded.units[0].lesson.beginner, base.units[0].lesson.beginner);
  assert.equal(upgraded.units[0].lesson.beginnerVisuals.length, 1);
  await make().generate('calculus', 0); assert.equal(enrichCalls, 1);
});

test('図解の増補は選んだ章だけで、増補後は再起動・連打でも再課金しない', async t => {
  let extras = 0;
  const { service, make, calls } = await fixture(t, { async enrich(unit) { extras++; return reply({ beginnerVisuals: [], standardVisuals: [] }); } });
  const base = await service.generate('calculus', 0);
  assert.equal(base.chapters[0].enhanced, false);
  const [a, b] = await Promise.all([service.enhance('calculus', 0), service.enhance('calculus', 0)]);
  assert.equal(extras, 1); assert.equal(a.chapters[0].enhanced, true); assert.deepEqual(a, b);
  assert.equal(a.units[0].lesson.beginner, base.units[0].lesson.beginner);
  assert.ok(a.chapters[1].units.every(i => !a.units[i].lesson));
  await make().enhance('calculus', 0); assert.equal(extras, 1); assert.equal(calls.lesson, 1);
});

test('旧版の増補を読むだけでは課金せず、新しい比較図は明示した時だけ保存する', async () => {
  const records = new Map(); let calls = 0;
  const unit = studyUnits(source.pages.slice(0, 1))[0];
  const lesson = { title: '関数', sourceQuote: unit.text.slice(0, 30), beginner: '保存済みの初級本文です。具体例から定義と重要な条件を確かめて理解を進めます。', standard: '保存済みの中級本文です。適用条件と定義の意味を原文に照らし合わせて確認します。', beginnerVisuals: [], standardVisuals: [] };
  const key = stage => artifactKey({ version: 2, source: source.hash, chapters: source.chapters, stage, model: 'gpt-4.1-mini' });
  records.set(key(0), { ...reply(lesson), visualEdition: 2 });
  const figure = { kind: 'flow', after: '具体例から', title: '既存の図', caption: '既存の説明', graph: null, terms: [], nodes: [{ label: '具体例', detail: '調べる' }, { label: '定義', detail: '確認する' }] };
  records.set(key(`visuals-v2:0:${artifactKey([lesson.beginner, lesson.standard])}`), reply({ beginnerVisuals: [figure], standardVisuals: [] }));
  const service = createStudyService({ storage: { read: async k => records.get(k), write: async (k, value) => records.set(k, value) }, readSource: async () => source,
    provider: { enrich: async () => { calls++; return reply({ beginnerVisuals: [{ ...figure, kind: 'comparison' }], standardVisuals: [] }); } } });
  const old = await service.status('calculus');
  assert.equal(old.units[0].lesson.beginnerVisuals[0].kind, 'flow'); assert.equal(calls, 0);
  assert.equal(old.chapters[0].enhanced, false);
  const updated = await service.enhance('calculus', 0);
  assert.equal(updated.units[0].lesson.beginner, lesson.beginner);
  assert.equal(updated.units[0].lesson.beginnerVisuals[0].kind, 'comparison');
  await service.enhance('calculus', 0); assert.equal(calls, 1);
  assert.ok(records.has(key(`visuals-v2:0:${artifactKey([lesson.beginner, lesson.standard])}`)));
});
test('元PDFの変更では古い教材を流用しない', async t => {
  const { service, make } = await fixture(t);
  await service.generate('calculus', 0);
  const changed = await make({ ...source, hash: 'changed-pdf' }).status('calculus');
  assert.ok(changed.units.every(unit => !unit.lesson));
});
test('検証できない有料応答も保存し、再押下で再生成しない', async t => {
  const { service, calls, directory, make } = await fixture(t, { async lesson() { calls.lesson++; return reply({ title: '捏造', sourceQuote: '原文に存在しない引用' }); } });
  await assert.rejects(service.generate('calculus', 0), /UNGROUNDED/);
  await assert.rejects(make().generate('calculus', 0), /UNGROUNDED/);
  assert.equal(calls.lesson, 1); assert.equal((await readdir(directory)).length, 1);
});
test('外部Originと任意パス・生成以外の操作を拒否する', async t => {
  const { service, calls } = await fixture(t), endpoint = createStudyEndpoint({ service });
  const request = (id, origin = 'https://app.test', chapter = 0) => new Request('https://app.test/api/study', { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify({ action: 'generate', id, chapter }) });
  assert.equal((await endpoint(request('../secret'))).status, 400);
  assert.equal((await endpoint(request('calculus', 'https://evil.test'))).status, 403);
  for (const chapter of [-1, 999, 0.5, null]) assert.equal((await endpoint(request('calculus', 'https://app.test', chapter))).status, 400);
  assert.deepEqual(calls, { outline: 0, lesson: 0 });
});

test('長い章の途中から再開しても別の章の本文をAPIに送らない', async t => {
  const sent = [];
  const { make, calls } = await fixture(t, { async lesson(unit) {
    calls.lesson++; sent.push(unit);
    return reply({ title: unit.title, sourceQuote: unit.text.slice(0, 30), beginner: '初級では大切な概念を具体例から順に学びます。重要な条件も確認して理解を進める教材です。', standard: '中級では定義と適用条件を確かめて原文へ進みます。応用と理解確認を含む詳しい説明です。' });
  } });
  const longSource = { ...source, pages: [{ page: 1, text: '第1章だけの内容。'.repeat(2000) }, { page: 2, text: '他の章にしか存在しない機密ではないテスト文。' }] };
  let state = await make(longSource).generate('calculus', 0);
  assert.ok(!state.chapters[0].complete);
  const restarted = make(longSource);
  while (!state.chapters[0].complete) state = await restarted.generate('calculus', 0);
  assert.equal(calls.lesson, state.chapters[0].units.length);
  assert.equal(calls.outline, 0);
  assert.ok(!JSON.stringify(sent).includes('他の章にしか存在しない'));
  assert.equal(state.chapters[1].complete, false);
});
test('OpenAIはサーバーのヘッダーだけにキーを置き、2段階を一度に構造化出力する', async () => {
  const provider = createStudyProvider({ key: () => 'test-secret', fetcher: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    assert.ok(!options.body.includes('test-secret'));
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    assert.ok(body.text.format.schema.required.includes('beginner')); assert.ok(body.text.format.schema.required.includes('standard'));
    assert.ok(body.text.format.schema.required.includes('beginnerVisuals')); assert.ok(body.text.format.schema.required.includes('standardVisuals'));
    return Response.json(reply({}));
  } });
  await provider.lesson(studyUnits(source.pages)[0], {});
});
