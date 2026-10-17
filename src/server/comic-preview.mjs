import sharp from 'sharp';

// 生成・参照用の原画像は変更せず、画面への配信だけを軽くする。
export function createComicPreview(storage) {
  const pending = new Map();
  return async (key, index) => {
    const id = `${key}:${index}`;
    if (!pending.has(id)) {
      const job = (async () => {
        try { return { bytes: await storage.preview(key, index), type: 'image/webp' }; }
        catch { /* 未作成なら元の画像から作る。 */ }
        const original = await storage.image(key, index);
        try {
          const bytes = await sharp(original, { limitInputPixels: 16000000 }).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
          if (bytes.length < original.length) {
            await storage.write(key, bytes, `${index}.preview-v1.webp`).catch(() => {});
            return { bytes, type: 'image/webp' };
          }
        } catch { /* 変換できない場合も保存済みPNGは表示する。 */ }
        return { bytes: original, type: 'image/png' };
      })().finally(() => pending.delete(id));
      pending.set(id, job);
    }
    return pending.get(id);
  };
}
