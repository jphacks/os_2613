import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseCsv, parseCatalog, searchCatalog, htmlToText, createAozoraService } from '../src/server/aozora.mjs';
import { csvFromZip } from '../src/server/zip.mjs';
import { mkdtemp, readFile, writeFile, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const columns = ['作品ID', '作品名', '作品名読み', '副題', '作品著作権フラグ', '人物著作権フラグ', '図書カードURL', 'XHTML/HTMLファイルURL', '姓', '名', '役割フラグ', '文字遣い種別', 'XHTML/HTMLファイル符号化方式'];
const entry = (values = {}) => ({ 作品ID: '000001', 作品名: '銀河の本', 作品名読み: 'ぎんがのほん', 副題: '', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 図書カードURL: 'https://www.aozora.gr.jp/cards/000001/card1.html', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/1_2.html', 姓: '宮沢', 名: '賢治', 役割フラグ: '著者', 文字遣い種別: '新字新仮名', 'XHTML/HTMLファイル符号化方式': 'UTF-8', ...values });
const csv = entries => '\uFEFF' + [columns, ...entries.map(row => columns.map(name => row[name]))].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');

function zip(text) {
  const name = Buffer.from('catalog.csv'), source = Buffer.from(text), compressed = deflateRawSync(source);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(source.length, 24); central.writeUInt16LE(name.length, 28);
  const footer = Buffer.alloc(22); footer.writeUInt32LE(0x06054b50); footer.writeUInt16LE(1, 10); footer.writeUInt32LE(central.length + name.length, 12); footer.writeUInt32LE(local.length + name.length + compressed.length, 16);
  return Buffer.concat([local, name, compressed, central, name, footer]);
}

test('CSVの引用符・改行・カンマを正しく読む', () => {
  assert.deepEqual(parseCsv('"a,b","a""b"\r\n"c\nd",e'), [['a,b', 'a"b'], ['c\nd', 'e']]);
});

test('著作権が残る作品と権利不明の作品・翻訳を対象外にする', () => {
  const books = parseCatalog(csv([entry(), entry({ 作品ID: '2', 作品著作権フラグ: 'あり' }), entry({ 作品ID: '3', 人物著作権フラグ: '' }), entry({ 人物著作権フラグ: 'あり', 役割フラグ: '翻訳者' })]));
  assert.equal(books.length, 0);
});

test('同じ作品を著者行ごとに重複させず、公式サイト以外のURLを採用しない', () => {
  const books = parseCatalog(csv([entry(), entry({ 姓: '別の', 名: '著者' }), entry({ 作品ID: '2', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp.evil.test/cards/000001/files/1_2.html' })]));
  assert.equal(books.length, 1); assert.equal(books[0].author, '宮沢 賢治 / 別の 著者');
});

test('タイトル・読み・著者の検索とページ分割を行う', () => {
  const books = parseCatalog(csv(Array.from({ length: 25 }, (_, i) => entry({ 作品ID: String(i + 1) }))));
  assert.equal(searchCatalog(books, 'ギンガ', 'title', 1).total, 25);
  assert.equal(searchCatalog(books, '宮沢', 'author', 2).results.length, 5);
  assert.equal(searchCatalog(books, '宮沢', 'title', 1).total, 0);
  assert.equal(searchCatalog(books, '銀河 宮沢', 'keyword', 1).results.length, 20);
});

test('本文を抽出し、ルビ・スクリプト・底本情報を本文に混ぜない', () => {
  const html = '<div class="main_text"><p>銀河<ruby>鉄道<rt>てつどう</rt></ruby>の夜。<br />星&amp;空&#x3002;</p><script>bad()</script></div><div class="bibliographical_information">底本</div></body>';
  assert.equal(htmlToText(html), '銀河鉄道の夜。\n星&空。');
  assert.throws(() => htmlToText('<p>本文ではない</p>'));
});

test('圧縮された作品一覧を展開し、壊れたZIPを拒否する', () => {
  assert.equal(csvFromZip(zip('作品一覧')), '作品一覧');
  assert.throws(() => csvFromZip(Buffer.from('invalid')));
});

test('作品一覧を再利用し、本文は選択した作品だけ取り込む', async () => {
  const calls = [];
  const service = createAozoraService({ fetcher: async url => {
    calls.push(String(url));
    return String(url).endsWith('.zip') ? new Response(zip(csv([entry()]))) : new Response('<div class="main_text">実際の本文。<br />次の行。</div></body>');
  } });
  assert.equal((await service.search('銀河', 'title', 1)).total, 1);
  await service.search('宮沢', 'author', 1);
  assert.equal(calls.length, 1);
  const book = await service.importBook(1);
  assert.equal(book.text, '実際の本文。\n次の行。');
  assert.equal(book.id, 'aozora-1'); assert.equal(calls.length, 2);
  await assert.rejects(() => service.importBook(999)); assert.equal(calls.length, 2);
});

test('公式ミラーへの転送をHTTPSで取得し、外部への転送を拒否する', async () => {
  const urls = [];
  const service = createAozoraService({ fetcher: async (url, options) => {
    urls.push(String(url));
    assert.equal(options.headers['User-Agent'], 'DopaBooks/1.0');
    return urls.length === 1 ? new Response(null, { status: 302, headers: { location: 'http://mirror.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip' } }) : new Response(zip(csv([entry()])));
  } });
  assert.equal((await service.search('銀河', 'title', 1)).total, 1);
  assert.equal(urls[1], 'https://mirror.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip');
  let calls = 0;
  const blocked = createAozoraService({ fetcher: async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://example.com/catalog.zip' } }); } });
  await assert.rejects(() => blocked.search('本', 'title', 1)); assert.equal(calls, 1);
});

test('再起動後もディスクの一覧を使い、期限切れ・破損時だけ公式から再取得する', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dopabooks-catalog-'));
  t.after(async () => { if (!resolve(root).startsWith(resolve(tmpdir()) + sep + 'dopabooks-catalog-')) throw new Error('UNSAFE_TEST_PATH'); await rm(root, { recursive: true, force: true }); });
  const cachePath = join(root, 'catalog.zip'); let calls = 0;
  const fetcher = async () => { calls++; return new Response(zip(csv([entry()]))); };
  await createAozoraService({ fetcher, cachePath }).search('銀河', 'title', 1);
  assert.equal(calls, 1);
  assert.equal((await createAozoraService({ fetcher, cachePath }).search('銀河', 'title', 1)).total, 1);
  assert.equal(calls, 1);
  assert.equal(csvFromZip(await readFile(cachePath)), csv([entry()]));
  await utimes(cachePath, new Date(0), new Date(0));
  await createAozoraService({ fetcher, cachePath }).search('銀河', 'title', 1);
  assert.equal(calls, 2);
  await writeFile(cachePath, 'broken');
  await createAozoraService({ fetcher, cachePath }).search('銀河', 'title', 1);
  assert.equal(calls, 3);
  // 書けない保存先でも検索は成功する。
  assert.equal((await createAozoraService({ fetcher, cachePath: join(cachePath, 'invalid.zip') }).search('銀河', 'title', 1)).total, 1);
});
