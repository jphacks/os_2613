import { artifactKey, artifactStorage, artifactInput, artifactFailure } from './artifact-storage.mjs';
import { createBookArtifactProvider, validPng } from './book-artifact-provider.mjs';
import { groundedGraph, characterLimit } from '../features/characters/model.mjs';
import { validateScript } from '../features/comic/model.mjs';
import { resolve } from 'node:path';
const send = (status, value) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = error => send(error?.message === 'ORIGIN' ? 403 : error?.message === 'INVALID_INPUT' ? 400 : 503, artifactFailure(error));
export function createCharactersEndpoint({ provider = createBookArtifactProvider(), root = '.local/character-graphs' } = {}) {
  const storage = artifactStorage(root), pending = new Map(); let calls = 0;
  return async request => {
    try {
      if (request.method !== 'POST') return send(405, { error: '相関図の画面から操作してください。' });
      const input = await artifactInput(request, 610000);
      if (Object.keys(input).length !== 1 || typeof input.text !== 'string' || !input.text.trim() || input.text.length > characterLimit) throw new Error('INVALID_INPUT');
      const text = input.text, key = artifactKey(['characters-v1', text]);
      const cached = await storage.read(key);
      if (cached) { if (cached.text !== text) throw new Error('STORAGE'); return send(200, { graph: groundedGraph(cached.graph, text) }); }
      if (!pending.has(key)) {
        if (pending.size) throw new Error('BUSY');
        if (provider.configured === false) throw new Error('NOT_CONFIGURED');
        if (calls >= 20) throw new Error('LIMIT'); calls++;
        const job = Promise.resolve().then(() => provider.characters(text)).then(value => groundedGraph(value, text)).then(async graph => { await storage.write(key, { text, graph }); return graph; }).finally(() => pending.delete(key));
        pending.set(key, job);
      }
      return send(200, { graph: await pending.get(key) });
    } catch (error) { return fail(error); }
  };
}
export function createComicEndpoint({ provider = createBookArtifactProvider(), root = '.local/book-comics' } = {}) {
  // 開発サーバーがAPIモジュールを読み直しても、実行中のジョブと保存キューを共有する。
  const registry = globalThis[Symbol.for('dopabooks.comic.runtime.v1')] ??= new Map();
  const identity = resolve(root);
  if (!registry.has(identity)) registry.set(identity, { storage: artifactStorage(root), jobs: new Map() });
  const { storage, jobs } = registry.get(identity);
  function state(key, record) {
    const interrupted = record.status === 'running' && !jobs.has(key);
    return { key, status: jobs.has(key) && record.status !== 'ready' ? 'running' : interrupted ? 'error' : record.status, script: record.script, completed: record.completed,
      canResumeRemaining: !!record.script && record.completed < 4 && record.imageAttempts >= (record.imageLimit ?? 8),
      ...(record.error ? { failure: record.error } : interrupted ? { failure: { code: 'INTERRUPTED', error: '作成を中断しました。保存済みのコマから再開できます。' } } : {}) };
  }
  async function generate(key) {
    try {
      let record = await storage.read(key); if (!record) throw new Error('NOT_FOUND');
      record = await storage.update(key, value => ({ ...value, status: 'running', error: null }));
      if (!record.script) {
        if (record.scriptAttempts >= 3) throw new Error('LIMIT');
        record = await storage.update(key, value => ({ ...value, scriptAttempts: value.scriptAttempts + 1 }));
        const script = validateScript(await provider.script(record.source), record.source.opening);
        record = await storage.update(key, value => ({ ...value, script }));
      }
      for (let index = record.completed; index < 4; index++) {
        // 画像保存の直後に記録の更新が失敗・中断した場合も、再生成せず回収する。
        let existing = false;
        try { validPng((await storage.image(key, index + 1)).toString('base64')); existing = true; }
        catch (error) { if (error.code !== 'ENOENT') throw new Error('STORAGE'); }
        if (existing) { record = await storage.update(key, value => ({ ...value, completed: index + 1 })); continue; }
        if (record.imageAttempts >= (record.imageLimit ?? 8)) throw new Error('LIMIT');
        record = await storage.update(key, value => ({ ...value, imageAttempts: value.imageAttempts + 1 }));
        const reference = index ? (await storage.image(key, 1)).toString('base64') : null;
        const image = validPng(await provider.image(record.script, index, reference));
        await storage.write(key, image, `${index + 1}.png`);
        record = await storage.update(key, value => ({ ...value, completed: index + 1 }));
      }
      await storage.update(key, value => ({ ...value, status: 'ready', error: null }));
    } catch (error) { await storage.update(key, value => ({ ...value, status: 'error', error: artifactFailure(error) })).catch(() => {}); }
  }
  return async request => {
    try {
      if (request.method === 'GET') {
        const url = new URL(request.url), key = url.searchParams.get('key') ?? '', image = url.searchParams.get('image');
        const record = await storage.read(key); if (!record) throw new Error('NOT_FOUND');
        if (image !== null) {
          const index = Number(image); if (!/^[1-4]$/.test(image) || index > record.completed) throw new Error('NOT_FOUND');
          return new Response(new Uint8Array(await storage.image(key, index)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
        }
        return send(200, state(key, record));
      }
      if (request.method !== 'POST') return send(405, { error: '紹介漫画の画面から操作してください。' });
      const input = await artifactInput(request, 210000);
      if (input.action === 'register') {
        const { bookId, title, opening, context } = input;
        if (typeof bookId !== 'string' || !bookId || bookId.length > 120 || typeof title !== 'string' || !title.trim() || title.length > 200 || typeof opening !== 'string' || !opening.trim() || opening.length > 12000 || typeof context !== 'string' || context.length > 20000 || !context.startsWith(opening)) throw new Error('INVALID_INPUT');
        const source = { title, opening, context }, key = artifactKey(['comic-v1', bookId, source]);
        const record = await storage.update(key, value => value ?? { source, script: null, completed: 0, scriptAttempts: 0, imageAttempts: 0, status: 'idle', error: null });
        return send(200, state(key, record));
      }
      if (input.action !== 'start') throw new Error('INVALID_INPUT');
      const key = input.key, record = await storage.read(key); if (!record) throw new Error('NOT_FOUND');
      if (record.status === 'ready') return send(200, state(key, record));
      if (!jobs.has(key)) {
        if (provider.configured === false) throw new Error('NOT_CONFIGURED');
        if (jobs.size >= 1) throw new Error('BUSY');
        const job = Promise.resolve().then(async () => {
          if (input.resumeRemaining === true && record.script && record.completed < 4) {
            await storage.update(key, value => value.imageAttempts >= (value.imageLimit ?? 8) ? { ...value, imageLimit: value.imageAttempts + 4 - value.completed } : value);
          }
          return generate(key);
        }).catch(() => {}).finally(() => jobs.delete(key)); jobs.set(key, job);
      }
      return send(202, { ...state(key, record), status: 'running', failure: undefined });
    } catch (error) { return fail(error); }
  };
}
