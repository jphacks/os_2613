import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibraryRepository } from '../src/features/library/repository.mjs';

const book = id => ({ id: `aozora-${id}`, aozoraId: id, title: `作品${id}`, subtitle: '', author: '著者', text: '本文。', characters: '新字新仮名', cardUrl: `https://www.aozora.gr.jp/cards/000001/card${id}.html`, htmlUrl: `https://www.aozora.gr.jp/cards/000001/files/${id}_1.html`, importedAt: '2026-10-17T00:00:00.000Z' });
function memoryStorage(initial = null) {
  let value = initial;
  return { async getItem(key) { assert.equal(key, 'dopabooks:library:v1'); return value; }, async setItem(key, next) { assert.equal(key, 'dopabooks:library:v1'); value = next; } };
}

test('既存Webの保存形式を読み、再起動相当の読み直しでも本を保持する', async () => {
  const storage = memoryStorage(JSON.stringify([book(1)]));
  const repository = createLibraryRepository(storage);
  assert.deepEqual(await repository.load(), [book(1)]);
  await repository.add(book(2));
  assert.deepEqual(await createLibraryRepository(storage).load(), [book(1), book(2)]);
});

test('非同期の同時追加で本を失わず、同じ作品は重複保存しない', async () => {
  const repository = createLibraryRepository(memoryStorage());
  await Promise.all([repository.add(book(1)), repository.add(book(2)), repository.add(book(1))]);
  assert.deepEqual(await repository.add(book(2)), [book(1), book(2)]);
});

test('保存失敗で一覧を更新せず、その後の追加は再試行できる', async () => {
  const storage = memoryStorage(JSON.stringify([book(1)]));
  let fail = true;
  const repository = createLibraryRepository({ getItem: storage.getItem, async setItem(key, value) { if (fail) throw new Error('full'); await storage.setItem(key, value); } });
  await assert.rejects(repository.add(book(2)));
  assert.deepEqual(await repository.add(book(1)), [book(1)]);
  fail = false;
  assert.deepEqual(await repository.add(book(3)), [book(1), book(3)]);
});

test('保存データが壊れているときは、既存データを上書きしない', async () => {
  let writes = 0;
  const repository = createLibraryRepository({ async getItem() { return '{broken'; }, async setItem() { writes++; } });
  await assert.rejects(repository.load()); await assert.rejects(repository.add(book(1)));
  assert.equal(writes, 0);
});


test('収録本を空の本棚へ登録し、保存後の再読み込みや同時追加でも重複しない', async () => {
  const storage = memoryStorage();
  const repository = createLibraryRepository(storage, [book(1567)]);
  assert.deepEqual(await repository.load(), [book(1567)]);
  await Promise.all([repository.add(book(1567)), repository.add(book(2))]);
  assert.deepEqual(await createLibraryRepository(storage, [book(1567)]).load(), [book(1567), book(2)]);
});

test('既存の本棚を残して収録本を補い、登録済みの本文や追加日時は上書きしない', async () => {
  const original = { ...book(1567), text: '以前の本文', importedAt: '2025-01-01T00:00:00Z' };
  const storage = memoryStorage(JSON.stringify([book(1), original]));
  assert.deepEqual(await createLibraryRepository(storage, [book(1567)]).load(), [book(1), original]);
  const other = memoryStorage(JSON.stringify([book(1)]));
  assert.deepEqual(await createLibraryRepository(other, [book(1567)]).load(), [book(1), book(1567)]);
});

test('保存データが壊れている場合は収録本を登録して既存データを上書きしない', async () => {
  let writes = 0;
  const repository = createLibraryRepository({ getItem: async () => '{broken', setItem: async () => { writes++; } }, [book(1567)]);
  await assert.rejects(repository.load()); assert.equal(writes, 0);
});

test('同梱の走れメロスは本文・出典を持ち、既存漫画と同じ本IDで開ける', async () => {
  const { readFile } = await import('node:fs/promises');
  const melos = JSON.parse(await readFile(new URL('../assets/books/aozora/hashire-melos.json', import.meta.url), 'utf8'));
  const repository = createLibraryRepository(memoryStorage(), [melos]);
  const [saved] = await repository.load();
  assert.equal(saved.id, 'aozora-1567'); assert.equal(saved.aozoraId, 1567);
  assert.equal(saved.title, '走れメロス'); assert.ok(saved.text.length > 9000);
  assert.ok(saved.text.startsWith('メロスは激怒した。')); assert.match(saved.htmlUrl, /^https:\/\/www\.aozora\.gr\.jp\//);
});
