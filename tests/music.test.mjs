import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicService } from '../src/server/music.mjs';

const track = { id: 1, name: 'Quiet music', username: 'artist', license: 'http://creativecommons.org/licenses/by/4.0/', url: 'https://freesound.org/people/artist/sounds/1/', tags: ['music'], previews: { 'preview-lq-mp3': 'https://cdn.freesound.org/previews/1.mp3' } };
test('missing key and invalid mood never call upstream', async () => {
  const search = createMusicService({ key: () => '', fetcher: () => assert.fail('network called') });
  await assert.rejects(search('calm'), /KEY/);
  await assert.rejects(search('unknown'), /MOOD/);
});
test('auth stays in header; candidates are filtered, bounded and cached', async () => {
  let calls = 0;
  const search = createMusicService({ key: () => 'test-secret', fetcher: async (url, options) => {
    calls++;
    assert.equal(url.pathname, '/apiv2/search/');
    assert.ok(!url.toString().includes('test-secret'));
    assert.equal(options.headers.Authorization, 'Token test-secret');
    return Response.json({ results: [{ ...track, license: 'https://creativecommons.org/licenses/by-nc/4.0/' }, { ...track, tags: ['vocals'] }, { ...track, previews: { 'preview-lq-mp3': 'https://evil.test/file' } }, ...Array.from({ length: 5 }, (_, id) => ({ ...track, id }))] });
  } });
  assert.equal((await search('calm')).length, 3);
  await search('calm');
  assert.equal(calls, 1);
});
test('upstream failures become safe error codes', async () => {
  for (const [status, code] of [[401, 'AUTH'], [429, 'LIMIT'], [500, 'UPSTREAM']]) {
    const search = createMusicService({ key: () => 'test', fetcher: async () => new Response('', { status }) });
    await assert.rejects(search('calm'), new RegExp(code));
  }
});
test('文脈検索は検索語を使い、声・心情と逆の曲を避けて一致順に並べる', async () => {
  const search = createMusicService({ key: () => 'test', fetcher: async url => {
    assert.equal(url.searchParams.get('query'), 'dark strings music');
    return Response.json({ results: [{ ...track, id: 1, name: 'Happy uplifting music' }, { ...track, id: 2, name: 'Dark strings music vocals' }, { ...track, id: 3, name: 'Piano music' }, { ...track, id: 4, name: 'Dark strings music' }] });
  } });
  assert.deepEqual((await search('tense', 'dark strings music')).map(item => item.id), [4, 3]);
  await assert.rejects(search('tense', 'x&token=secret'), /QUERY/);
});
