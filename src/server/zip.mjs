import { inflateRawSync } from 'node:zlib';

export function csvFromZip(input) {
  const zip = Buffer.from(input);
  let footer = zip.length - 22;
  while (footer >= Math.max(0, zip.length - 65557) && zip.readUInt32LE(footer) !== 0x06054b50) footer--;
  if (footer < Math.max(0, zip.length - 65557)) throw new Error('作品一覧のZIP形式を確認できません。');
  let cursor = zip.readUInt32LE(footer + 16);
  const count = zip.readUInt16LE(footer + 10);
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > zip.length || zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('作品一覧が壊れています。');
    const method = zip.readUInt16LE(cursor + 10), size = zip.readUInt32LE(cursor + 20), expanded = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28), extra = zip.readUInt16LE(cursor + 30), comment = zip.readUInt16LE(cursor + 32);
    const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    if (name.endsWith('.csv')) {
      if (expanded > 40 * 1024 * 1024) throw new Error('作品一覧が大きすぎます。');
      const local = zip.readUInt32LE(cursor + 42);
      if (local + 30 > zip.length || zip.readUInt32LE(local) !== 0x04034b50) throw new Error('作品一覧が壊れています。');
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      if (start + size > zip.length) throw new Error('作品一覧が途中で切れています。');
      const data = zip.subarray(start, start + size);
      if (method !== 0 && method !== 8) throw new Error('作品一覧の圧縮形式に対応していません。');
      return (method === 0 ? data : inflateRawSync(data, { maxOutputLength: 40 * 1024 * 1024 })).toString('utf8');
    }
    cursor += 46 + nameLength + extra + comment;
  }
  throw new Error('作品一覧のCSVがありません。');
}
