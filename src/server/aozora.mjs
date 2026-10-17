import { csvFromZip } from './zip.mjs';
import { mkdir, readFile, writeFile, rename, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const catalogUrl = 'https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip';

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else cell += c;
  }
  if (quoted) throw new Error('作品一覧を読み取れません。');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function officialUrl(value, kind) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !['www.aozora.gr.jp', 'aozora.gr.jp'].includes(url.hostname) || url.username || url.password || url.port) return '';
    if (!(kind === 'card' ? /^\/cards\/\d+\/card\d+\.html$/ : /^\/cards\/\d+\/files\/[\w.-]+\.html?$/).test(url.pathname)) return '';
    return `https://www.aozora.gr.jp${url.pathname}`;
  } catch { return ''; }
}

export function parseCatalog(csv) {
  const [header, ...rows] = parseCsv(csv.replace(/^\uFEFF/, ''));
  const columns = new Map(header.map((name, index) => [name, index]));
  for (const name of ['作品ID', '作品名', '作品著作権フラグ', '人物著作権フラグ', '図書カードURL', 'XHTML/HTMLファイルURL']) if (!columns.has(name)) throw new Error('作品一覧の形式が変わっています。');
  const books = new Map(), blocked = new Set();
  for (const row of rows) {
    const get = name => row[columns.get(name)]?.trim() ?? '';
    const aozoraId = Number(get('作品ID'));
    if (!Number.isSafeInteger(aozoraId) || aozoraId <= 0) continue;
    if (get('作品著作権フラグ') !== 'なし' || get('人物著作権フラグ') !== 'なし') { blocked.add(aozoraId); continue; }
    const cardUrl = officialUrl(get('図書カードURL'), 'card'), htmlUrl = officialUrl(get('XHTML/HTMLファイルURL'), 'html');
    if (!cardUrl || !htmlUrl) continue;
    let book = books.get(aozoraId);
    if (!book) {
      book = { id: `aozora-${aozoraId}`, aozoraId, title: get('作品名'), subtitle: get('副題'), author: '', cardUrl, htmlUrl, characters: get('文字遣い種別'), encoding: get('XHTML/HTMLファイル符号化方式'), names: [], reading: get('作品名読み') };
      books.set(aozoraId, book);
    }
    const name = [get('姓'), get('名')].filter(Boolean).join(' ');
    const label = get('役割フラグ') === '翻訳者' ? `${name}（訳）` : name;
    if (label && !book.names.includes(label)) book.names.push(label);
    book.author = book.names.join(' / ');
  }
  return [...books.values()].filter(book => !blocked.has(book.aozoraId) && book.title);
}

function normalize(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function searchCatalog(books, query, field = 'keyword', page = 1) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  const matches = books.filter(book => {
    const haystack = normalize(field === 'author' ? book.author : field === 'title' ? `${book.title} ${book.subtitle} ${book.reading}` : `${book.title} ${book.subtitle} ${book.reading} ${book.author}`);
    return terms.every(term => haystack.includes(term));
  });
  return { total: matches.length, page, results: matches.slice((page - 1) * 20, page * 20).map(({ names, reading, encoding, ...book }) => book) };
}

export function htmlToText(html) {
  const main = html.match(/<div\b[^>]*class=["']main_text["'][^>]*>([\s\S]*?)(?:<div\b[^>]*class=["'](?:bibliographical_information|after_text)["']|<\/body>)/i)?.[1];
  if (!main) throw new Error('本文の形式に対応していません。図書カードから作品を確認してください。');
  const plain = main.replace(/<(script|style|rt|rp)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, '$1')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&#(x[\da-f]+|\d+);/gi, (_, value) => {
      const n = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }).replace(/&(lt|gt|quot|apos|nbsp|amp);/g, (_, name) => ({ lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', amp: '&' })[name])
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!plain) throw new Error('本文が空です。別の作品を選んでください。');
  return plain;
}

async function download(url, fetcher, limit) {
  let response;
  for (let redirects = 0; redirects <= 3; redirects++) {
    response = await fetcher(url, { signal: AbortSignal.timeout(30000), redirect: 'manual', headers: { 'User-Agent': 'DopaBooks/1.0', Accept: '*/*' } });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const target = new URL(response.headers.get('location') ?? '', url);
    if (redirects === 3 || !['http:', 'https:'].includes(target.protocol) || !['www.aozora.gr.jp', 'aozora.gr.jp', 'mirror.aozora.gr.jp'].includes(target.hostname) || target.port || target.username || target.password) throw new Error('作品の転送先を確認できません。時間をおいて再試行してください。');
    // 一覧の公式ミラーがHTTPへ誘導する場合も、実際の取得はHTTPSに限定する。
    target.protocol = 'https:';
    // 公式サイト内の移動だけを追い、任意の外部URLへは接続しない。
    await response.body?.cancel?.();
    url = target.href;
  }
  if (!response.ok || !response.body) throw new Error('青空文庫に接続できません。時間をおいて再試行してください。');
  const chunks = []; let length = 0;
  for await (const value of response.body) {
    length += value.byteLength;
    if (length > limit) throw new Error('作品データが大きすぎます。別の作品を選んでください。');
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export function createAozoraService({ fetcher = fetch, cachePath = null, maxAgeMs = 24 * 60 * 60 * 1000 } = {}) {
  let pending, expires = 0;
  async function loadCatalog() {
    if (cachePath) {
      try {
        const info = await stat(cachePath), age = Date.now() - info.mtimeMs;
        // Windowsのファイル時刻はDate.now()より細かく、保存直後にわずかに未来になる場合がある。
        if (info.size <= 10 * 1024 * 1024 && age >= -1000 && age < maxAgeMs) return parseCatalog(csvFromZip(await readFile(cachePath)));
      } catch { /* 古い・壊れた一覧は公式データから再取得する。 */ }
    }
    const archive = await download(catalogUrl, fetcher, 10 * 1024 * 1024);
    const books = parseCatalog(csvFromZip(archive));
    if (cachePath) {
      const temp = `${cachePath}.${randomUUID()}.tmp`;
      try { await mkdir(dirname(cachePath), { recursive: true }); await writeFile(temp, archive); await rename(temp, cachePath); }
      catch { /* 保存できなくても、取得済みの一覧で検索を続ける。 */ }
      finally { await unlink(temp).catch(() => {}); }
    }
    return books;
  }
  async function catalog() {
    if (!pending || Date.now() >= expires) {
      expires = Date.now() + maxAgeMs;
      pending = loadCatalog().catch(error => { pending = null; throw error; });
    }
    return pending;
  }
  const imports = new Map();
  async function fetchBook(id) {
    const file = cachePath ? `${dirname(cachePath)}/book-${id}.json` : null;
    if (file) {
      try {
        const info = await stat(file);
        if (info.size < 5 * 1024 * 1024 && Date.now() - info.mtimeMs < maxAgeMs) {
          const cached = JSON.parse(await readFile(file, 'utf8'));
          const entry = (await catalog()).find(book => book.aozoraId === id);
          if (entry && cached.id === entry.id && cached.htmlUrl === entry.htmlUrl && typeof cached.text === 'string' && typeof cached.importedAt === 'string') return cached;
        }
      } catch { /* キャッシュなしなら公式本文から取得する。 */ }
    }
    const book = await fetchOriginal(id);
    if (file) {
      const temp = `${file}.${randomUUID()}.tmp`;
      try { await mkdir(dirname(file), { recursive: true }); await writeFile(temp, JSON.stringify(book)); await rename(temp, file); }
      catch { /* 保存できなくても取得した作品を返す。 */ }
      finally { await unlink(temp).catch(() => {}); }
    }
    return book;
  }
  async function fetchOriginal(id) {
      const entry = (await catalog()).find(book => book.aozoraId === id);
      if (!entry) throw new Error('取り込み可能な作品が見つかりません。もう一度検索してください。');
      const bytes = await download(entry.htmlUrl, fetcher, 4 * 1024 * 1024);
      const encoding = /utf-?8/i.test(entry.encoding) ? 'utf-8' : 'shift-jis';
      const text = htmlToText(new TextDecoder(encoding).decode(bytes));
      if (text.length > 1000000) throw new Error('本文が長すぎます。短い作品を選んでください。');
      const { names, reading, encoding: _, ...book } = entry;
      return { ...book, text, importedAt: new Date().toISOString() };
  }
  return {
    async search(query, field, page) { return searchCatalog(await catalog(), query, field, page); },
    async importBook(id) {
      const saved = imports.get(id);
      if (saved && saved.expires > Date.now()) return saved.promise;
      const item = { expires: Date.now() + maxAgeMs, promise: null };
      item.promise = fetchBook(id).catch(error => { if (imports.get(id) === item) imports.delete(id); throw error; });
      imports.set(id, item);
      if (imports.size > 8) imports.delete(imports.keys().next().value);
      return item.promise;
    },
  };
}
