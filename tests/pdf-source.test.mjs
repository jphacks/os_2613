import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pdfSource, PDF_CHUNK_BYTES } from '../src/features/pdf/source.mjs';

function reader(bytes) {
  return async (offset, length) => {
    assert.equal(length, PDF_CHUNK_BYTES);
    return { size: bytes.length, base64: bytes.subarray(offset, offset + length).toString('base64') };
  };
}

test('WebのURLは変更せず、端末ファイルの読み取りも呼び出さない', async () => {
  for (const uri of ['/assets/book.pdf', 'https://example.test/book.pdf']) {
    assert.deepEqual(await pdfSource(uri, () => { throw new Error('Must not read native files'); }), { url: uri });
  }
});

test('端末内PDFは非同期で読み取り、元ファイルと同じバイト列を表示側へ渡す', async () => {
  const bytes = Buffer.from('%PDF-1.7\n\x00\xff\x80\n%%EOF', 'latin1');
  for (const uri of ['file:///app/cache/book.pdf', 'content://app/book.pdf']) {
    const source = await pdfSource(uri, reader(bytes));
    assert.equal('url' in source, false);
    assert.deepEqual(Buffer.from(source.data), bytes);
  }
});

test('読み取り失敗や壊れたファイルは通知し、端末内パスをエラーへ含めない', async () => {
  await assert.rejects(pdfSource('file:///private/book.pdf'), /LOCAL_PDF_READER_MISSING/);
  await assert.rejects(pdfSource('file:///private/book.pdf', async () => { throw new Error('/private/book.pdf'); }), /^Error: LOCAL_PDF_READ_FAILED$/);
  await assert.rejects(pdfSource('file:///private/book.pdf', reader(Buffer.from('<html>Error</html>'))), /LOCAL_PDF_INVALID_DATA/);
});

test('途中で閉じたPDFは次の範囲を読み取らない', async () => {
  const bytes = Buffer.alloc(PDF_CHUNK_BYTES * 3);
  bytes.write('%PDF-1.7');
  let calls = 0;
  let cancelled = false;
  await assert.rejects(pdfSource('file:///app/book.pdf', async (...args) => {
    calls++;
    const chunk = await reader(bytes)(...args);
    if (calls === 2) cancelled = true;
    return chunk;
  }, () => cancelled), /LOCAL_PDF_CANCELLED/);
  assert.equal(calls, 2);
});

test('欠落した範囲や途中で変わったファイルは採用しない', async () => {
  const bytes = Buffer.alloc(PDF_CHUNK_BYTES + 10);
  bytes.write('%PDF-1.7');
  for (const corrupted of [{ size: bytes.length + 1 }, { base64: '' }]) {
    await assert.rejects(pdfSource('file:///app/book.pdf', async (offset, length) => {
      const chunk = await reader(bytes)(offset, length);
      return offset ? { ...chunk, ...corrupted } : chunk;
    }), /LOCAL_PDF_INVALID_DATA/);
  }
});

test('同梱教材4冊をネイティブ経路のデータでPDF.jsが読み取れる', async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  for (const name of ['calculus', 'thermodynamics', 'mathematics-for-economics', 'ai-for-teachers']) {
    const bytes = await readFile(new URL(`../assets/books/oej/${name}.pdf`, import.meta.url));
    let calls = 0;
    const source = await pdfSource(`file:///app/${name}.pdf`, async (...args) => {
      calls++;
      return reader(bytes)(...args);
    });
    assert.equal(calls, Math.ceil(bytes.length / PDF_CHUNK_BYTES));
    assert.deepEqual(Buffer.from(source.data), bytes);
    const task = getDocument({ ...source, isEvalSupported: false });
    try {
      const doc = await task.promise;
      assert.ok(doc.numPages > 0, name);
      const page = await doc.getPage(1);
      assert.ok(page.getViewport({ scale: 1 }).width > 0, name);
    } finally { await task.destroy(); }
  }
});
