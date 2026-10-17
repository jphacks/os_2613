import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createComicPreview } from '../src/server/comic-preview.mjs';

test('漫画を軽いWebPにし、元画像を維持して同時変換・次回変換を省く', async () => {
  const original = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: '#999999' } }).png({ compressionLevel: 0 }).toBuffer();
  let reads = 0, writes = 0, cached;
  const storage = { preview: async () => { if (!cached) throw new Error('ENOENT'); return cached; }, image: async () => { reads++; return original; }, write: async (key, value, name) => { writes++; assert.equal(name, '1.preview-v1.webp'); cached = value; } };
  const preview = createComicPreview(storage);
  const [a, b] = await Promise.all([preview('key', 1), preview('key', 1)]);
  assert.equal(a.type, 'image/webp'); assert.deepEqual(a, b);
  assert.ok(a.bytes.length < original.length / 10);
  const metadata = await sharp(a.bytes).metadata(); assert.equal(metadata.width, 1200); assert.equal(metadata.height, 800);
  assert.deepEqual(await createComicPreview(storage)('key', 1), a);
  assert.equal(reads, 1); assert.equal(writes, 1);
  assert.equal((await sharp(original).metadata()).width, 1536);
});

test('変換できない画像は元のPNGへ戻し、保存失敗でも配信できる', async () => {
  const original = Buffer.from('not-decodable');
  const result = await createComicPreview({ preview: async () => { throw new Error(); }, image: async () => original, write: async () => { throw new Error(); } })('key', 1);
  assert.equal(result.type, 'image/png'); assert.deepEqual(result.bytes, original);
  const png = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#aaaaaa' } }).png({ compressionLevel: 0 }).toBuffer();
  const converted = await createComicPreview({ preview: async () => { throw new Error(); }, image: async () => png, write: async () => { throw new Error(); } })('key', 1);
  assert.equal(converted.type, 'image/webp');
});
