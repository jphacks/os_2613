import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { chapterIndex } from './study-chapters.mjs';

// Extract all pages locally; no external service or API key is used.
const ids = ['calculus', 'thermodynamics', 'mathematics-for-economics', 'ai-for-teachers'];
await mkdir('data/study-sources', { recursive: true });
for (const id of ids) {
  const bytes = await readFile(`assets/books/oej/${id}.pdf`);
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true,
    cMapUrl: `${resolve('node_modules/pdfjs-dist/cmaps')}/`, cMapPacked: true,
    standardFontDataUrl: `${resolve('node_modules/pdfjs-dist/standard_fonts')}/` });
  const document = await task.promise;
  const pages = [];
  for (let p = 1; p <= document.numPages; p++) {
    const page = await document.getPage(p), content = await page.getTextContent();
    const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').replace(/[ \t]+\n/g, '\n').trim();
    pages.push({ page: p, text }); page.cleanup();
  }
  const chapters = await chapterIndex(document, id);
  await task.destroy();
  const hash = createHash('sha256').update(bytes).digest('hex');
  await writeFile(`data/study-sources/${id}.json`, JSON.stringify({ version: 2, id, hash, pages, chapters }));
  console.log(`${id}: ${pages.length} pages, ${pages.reduce((n, p) => n + p.text.length, 0)} characters`);
}
