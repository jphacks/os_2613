const queries = { calm: 'ambient music calm', tense: 'ambient music suspense', sad: 'ambient music sad', bright: 'instrumental music peaceful' };
export function createMusicService({ key = () => process.env.FREESOUND_API_KEY, fetcher = fetch } = {}) {
  const cache = new Map();
  return async function search(mood) {
    if (!Object.hasOwn(queries, mood)) throw new Error('MOOD');
    const token = key()?.trim();
    if (!token) throw new Error('KEY');
    const saved = cache.get(mood);
    if (saved && saved.until > Date.now()) return saved.tracks;
    const url = new URL('https://freesound.org/apiv2/search/');
    url.search = new URLSearchParams({ query: queries[mood], filter: 'duration:[20 TO 240]', fields: 'id,name,username,url,license,previews,tags', page_size: '30', sort: 'score' }).toString();
    const response = await fetcher(url, { headers: { Authorization: `Token ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'AUTH' : response.status === 429 ? 'LIMIT' : 'UPSTREAM');
    const data = await response.json();
    const tracks = (Array.isArray(data.results) ? data.results : []).filter(item => item && Number.isInteger(item.id) && typeof item.name === 'string' && typeof item.username === 'string')
      .map(item => ({ ...item, license: typeof item.license === 'string' ? item.license.replace(/^http:/, 'https:') : '' })).filter(item =>
      /^https:\/\/creativecommons.org\/licenses\/by\/\d/.test(item.license ?? '') || /^https:\/\/creativecommons.org\/publicdomain\/zero\//.test(item.license ?? '')
    ).filter(item => !item.tags?.some(tag => /^(speech|vocals|voice|singing)$/.test(tag)))
      .filter(item => /^https:\/\/cdn\.freesound\.org\//.test(item.previews?.['preview-lq-mp3'] ?? '') && /^https:\/\/freesound.org\//.test(item.url ?? ''))
      .slice(0, 3).map(item => ({ id: item.id, name: item.name, creator: item.username, license: item.license, url: item.url, audioUrl: item.previews['preview-lq-mp3'] }));
    cache.set(mood, { tracks, until: Date.now() + 3600000 });
    return tracks;
  };
}
