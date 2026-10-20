import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfCharacter, parsePdfMarks } from '../src/features/pdf/bookmarks.mjs';
test('文字しおりは日本語・絵文字の文字境界を保存する', () => {
  assert.equal(pdfCharacter('実数😀の定義', 3).offset, 2);
  assert.equal(pdfCharacter('実数😀の定義', 3).length, 2);
  assert.equal(pdfCharacter('実数😀の定義', 0).quote, '実数😀の定義');
  assert.equal(pdfCharacter('実数', 2), null);
});
test('ページと文字位置を読み直し、PDF識別子と引用を保持する', () => {
  const marks = [{id:'a',source:'pdf-fingerprint',page:5,offset:12,quote:'実数の性質'}, {id:'b',source:'pdf-fingerprint',page:7,offset:null,quote:''}];
  assert.deepEqual(parsePdfMarks(JSON.stringify(marks)), marks);
  assert.deepEqual(parsePdfMarks(null), []);
  for (const mark of [{...marks[0],page:0},{...marks[0],offset:-1},{...marks[0],offset:0.1},{...marks[0],source:null}]) assert.throws(() => parsePdfMarks(JSON.stringify([mark])));
  assert.throws(() => parsePdfMarks('壊れた記録'));
});
