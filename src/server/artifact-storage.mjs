import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
export function artifactKey(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function artifactStorage(root) {
  const queues = new Map();
  function path(key, file = 'record.json') {
    if (!/^[a-f0-9]{64}$/.test(key) || !/^(record\.json|[1-4]\.png|[1-4]\.preview-v1\.webp)$/.test(file)) throw new Error('INVALID_INPUT');
    return join(resolve(root), key, file);
  }
  async function read(key) {
    try { return JSON.parse(await readFile(path(key), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; if (error.message === 'INVALID_INPUT') throw error; throw new Error('STORAGE'); }
  }
  async function write(key, value, file = 'record.json') {
    const target = path(key, file), temp = `${target}.${randomUUID()}.tmp`;
    try {
      await mkdir(join(resolve(root), key), { recursive: true }); await writeFile(temp, file === 'record.json' ? JSON.stringify(value) : value);
      for (let attempt = 0; ; attempt++) {
        try { await rename(temp, target); break; }
        catch (error) { if (attempt >= 3 || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error; await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1))); }
      }
    }
    catch { throw new Error('STORAGE'); }
  }
  function serial(key, work) {
    const task = (queues.get(key) ?? Promise.resolve()).then(work), settled = task.catch(() => {});
    queues.set(key, settled); void settled.then(() => { if (queues.get(key) === settled) queues.delete(key); }); return task;
  }
  return { read: key => serial(key, () => read(key)), write: (key, value, file) => serial(key, () => write(key, value, file)),
    image: (key, index) => serial(key, () => readFile(path(key, `${index}.png`))),
    preview: (key, index) => serial(key, () => readFile(path(key, `${index}.preview-v1.webp`))),
    update: (key, change) => serial(key, async () => { const next = await change(await read(key)); await write(key, next); return next; }),
  };
}
export async function artifactInput(request, bytes) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) throw new Error('ORIGIN');
  if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('INVALID_INPUT');
  const reader = request.body?.getReader(); if (!reader) throw new Error('INVALID_INPUT');
  try {
    let size = 0, raw = ''; const decoder = new TextDecoder();
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > bytes) { await reader.cancel(); throw new Error('INVALID_INPUT'); } raw += decoder.decode(value, { stream: true }); }
    return JSON.parse(raw + decoder.decode());
  } catch (error) { throw new Error(error.message === 'ORIGIN' ? 'ORIGIN' : 'INVALID_INPUT'); }
  finally { reader.releaseLock(); }
}
export function artifactFailure(error) {
  const code = ['NOT_CONFIGURED', 'AUTH', 'RATE_LIMIT', 'BUSY', 'LIMIT', 'TIMEOUT', 'INCOMPLETE', 'UNGROUNDED', 'STORAGE', 'INVALID_INPUT', 'ORIGIN', 'NOT_FOUND'].includes(error?.message) ? error.message : 'FAILED';
  return { code, error: ({ NOT_CONFIGURED: '準備が整っていません。起動時の接続設定を確認してください。', AUTH: '生成サービスへ接続できません。接続設定を確認してください。', RATE_LIMIT: 'ただいま混み合っています。少し時間をおいてお試しください。', BUSY: '別の作成を進めています。少し待ってからお試しください。', LIMIT: '作成回数の上限に達しました。', TIMEOUT: '作成に時間がかかっています。保存状態を確認して、もう一度お試しください。', INCOMPLETE: '内容を最後まで作れませんでした。もう一度お試しください。', UNGROUNDED: '本文と一致する根拠を確認できませんでした。もう一度お試しください。', STORAGE: '保存できませんでした。保存先の空き容量や設定を確認してください。', INVALID_INPUT: '本文やしおりを選び直してください。', NOT_FOUND: '保存内容が見つかりません。画面を開き直してください。', ORIGIN: 'アプリを開き直してください。' })[code] ?? '作成できませんでした。保存状態を確認し、もう一度お試しください。' };
}
