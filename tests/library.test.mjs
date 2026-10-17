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
