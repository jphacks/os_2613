import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { missingMathBars, repairMathText } from '../src/features/pdf/math-text.mjs';
import { OPS, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfCharacter } from '../src/features/pdf/bookmarks.mjs';

// 全ページ対応の判定ではない。原本と全文照合した、このページの欠落を検出する。
test('熱力学5ページ目の見出し・本文・数式・ページ番号を全文取得し各文字をしおりにできる', async () => {
  const task = getDocument({
    data: new Uint8Array(await readFile(new URL('../assets/books/oej/thermodynamics.pdf', import.meta.url))),
    cMapUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/cmaps/', import.meta.url)).replaceAll('\\', '/') ,
    cMapPacked: true,
    standardFontDataUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)).replaceAll('\\', '/'),
  });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(5);
    const content = await page.getTextContent();
    const text = content.items.filter(item => 'str' in item).map(item => item.str).join('');
    const expected = await readFile(new URL('./fixtures/pdf/thermodynamics-page5.txt', import.meta.url), 'utf8');
    // PDFの組版上の空白と改行だけを除き、文字や数式記号は省かず比べる。
    assert.equal(text.replace(/\s/gu, ''), expected.replace(/\s/gu, ''));
    assert.ok(text.includes('N ∼ 1025'));
    assert.ok(text.includes('H2O'));
    for (let offset = 0; offset < text.length;) {
      const character = pdfCharacter(text, offset);
      assert.ok(character, `文字位置 ${offset} を選択できる`);
      assert.equal(character.offset, offset);
      assert.equal(character.quote.codePointAt(0), text.codePointAt(offset));
      offset += character.length;
    }
  } finally {
    await task.destroy();
  }
});

for (const name of ['calculus', 'mathematics-for-economics']) {
  test(`${name}の5ページ目は数式・脚注を含む全文を取得し、各文字をしおりにできる`, async () => {
    const task = getDocument({
      data: new Uint8Array(await readFile(new URL(`../assets/books/oej/${name}.pdf`, import.meta.url))),
      cMapUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/cmaps/', import.meta.url)).replaceAll('\\', '/'),
      cMapPacked: true, fontExtraProperties: true,
      standardFontDataUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)).replaceAll('\\', '/'),
    });
    try {
      const page = await (await task.promise).getPage(5);
      const [content, operators] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
      const fonts = {};
      for (const item of content.items) if (item.fontName) fonts[item.fontName] = page.commonObjs.get(item.fontName)?.name ?? '';
      const corrected = repairMathText(content, fonts, missingMathBars(operators, OPS, fonts));
      const text = corrected.items.filter(item => 'str' in item).map(item => item.str).join('');
      const expected = await readFile(new URL(`./fixtures/pdf/${name}-page5.txt`, import.meta.url), 'utf8');
      assert.equal(text.replace(/\s/gu, ''), expected.replace(/\s/gu, ''));
      for (let offset = 0; offset < text.length;) {
        const character = pdfCharacter(text, offset);
        assert.ok(character);
        assert.equal(character.quote.codePointAt(0), text.codePointAt(offset));
        offset += character.length;
      }
      if (name === 'calculus') {
        assert.equal((text.match(/↦/gu) ?? []).length, 2);
        assert.equal((text.match(/≠/gu) ?? []).length, 1);
      } else {
        assert.equal((text.match(/\|/gu) ?? []).length, 4);
        assert.equal((text.match(/⁄/gu) ?? []).length, 2);
        assert.ok(text.includes('↛'));
      }
    } finally { await task.destroy(); }
  });
}
