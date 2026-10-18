import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const source = resolve('.local/study-audio-sources');
const output = resolve('.local/study-audio-host');
await mkdir(output, { recursive: true });
const catalog = {};
for (const name of await readdir(source)) {
  if (!name.endsWith('.mp3')) continue;
  const bytes = await readFile(resolve(source, name));
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const target = `${name.slice(0, -4)}.${hash}.mp3`;
  await writeFile(resolve(output, target), bytes);
  catalog[name] = target;
}
await writeFile(resolve(output, 'catalog.json'), JSON.stringify(catalog, null, 2));
console.log('音源の公開用ファイルを準備しました。');
// eas deploy --export-dir .local/study-audio-host --alias study-audio --non-interactive
// --prod は付けない（同じプロジェクトの認証用サイトは別の配信先として維持する）。
