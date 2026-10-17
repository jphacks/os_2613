import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

let reference;
// 見本は絵柄の入力専用。本文や脚本の根拠としては使用しない。
export async function comicStyleReference() {
  reference ??= readFile(resolve('assets/comic-references/library-mystery.png'))
    .then(bytes => sharp(bytes).resize({ width: 768, withoutEnlargement: true }).png().toBuffer())
    .catch(() => { reference = undefined; throw new Error('STYLE_REFERENCE'); });
  return reference;
}
