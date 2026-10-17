const queries = { calm: 'ambient music calm', tense: 'ambient music suspense', sad: 'ambient music sad', bright: 'instrumental music peaceful' };
export function createMusicService({ key = () => process.env.FREESOUND_API_KEY, fetcher = fetch } = {}) {
  const cache = new Map();
  return async function search(mood, query, kind = 'music', fallback = false) {
    if (!Object.hasOwn(queries, mood)) throw new Error('MOOD');
    if (!['music', 'ambience', 'effect'].includes(kind)) throw new Error('QUERY');
    if (query !== undefined && (typeof query !== 'string' || !/^[a-zA-Z0-9 -]{2,100}$/.test(query))) throw new Error('QUERY');
    const token = key()?.trim();
    if (!token) throw new Error('KEY');
    const cacheKey = `${kind}:${mood}:${query ?? ''}`;
    const saved = cache.get(cacheKey);
    if (saved && saved.until > Date.now()) return saved.tracks;
    const url = new URL('https://freesound.org/apiv2/search/');
    url.search = new URLSearchParams({ query: query ?? queries[mood], filter: `duration:${kind === 'effect' ? '[0.15 TO 12]' : kind === 'ambience' ? '[1 TO 240]' : '[20 TO 240]'} (license:"Creative Commons 0" OR license:"Attribution")`, fields: 'id,name,username,url,license,previews,tags,duration', page_size: '30', sort: 'score' }).toString();
    const response = await fetcher(url, { headers: { Authorization: `Token ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'AUTH' : response.status === 429 ? 'LIMIT' : 'UPSTREAM');
    const data = await response.json();
    let tracks = (Array.isArray(data.results) ? data.results : []).filter(item => item && Number.isInteger(item.id) && typeof item.name === 'string' && typeof item.username === 'string')
      .map(item => ({ ...item, license: typeof item.license === 'string' ? item.license.replace(/^http:/, 'https:') : '' })).filter(item =>
      /^https:\/\/creativecommons.org\/licenses\/by\/\d/.test(item.license ?? '') || /^https:\/\/creativecommons.org\/publicdomain\/zero\//.test(item.license ?? '')
    ).filter(item => !/\b(speech|vocals?|voice|singing|lyrics|rap)\b/i.test(`${item.name} ${(item.tags ?? []).join(' ')}`))
      .filter(item => /^https:\/\/cdn\.freesound\.org\//.test(item.previews?.['preview-lq-mp3'] ?? '') && /^https:\/\/freesound.org\//.test(item.url ?? ''))
      .filter(item => {
        const metadata = `${item.name} ${(item.tags ?? []).join(' ')}`;
        const musical = /\b(music|piano|synth|melody|soundtrack|pad|drone|strings|orchestra|guitar|instrumental)\b/i.test(metadata);
        return kind === 'music' ? musical : !musical && (kind === 'effect' || !/\b(gunshot|explosion|scream|jump-scare|thunderclap)\b/i.test(metadata)) && relevance(item, query, true) > 0;
      })
      .filter(item => kind !== 'music' || !['tense', 'sad'].includes(mood) || !/\b(happy|cheerful|comedy|uplifting)\b/i.test(`${item.name} ${(item.tags ?? []).join(' ')}`))
      .filter(item => kind !== 'music' || mood !== 'bright' || !/\b(minor|horror|ominous|tragic|funeral|depressing)\b/i.test(`${item.name} ${(item.tags ?? []).join(' ')}`))
      .sort((a, b) => musicScore(b, query, mood) - musicScore(a, query, mood))
      .slice(0, 3).map(item => ({ id: item.id, name: item.name, creator: item.username, license: item.license, url: item.url, audioUrl: item.previews['preview-lq-mp3'], kind }));
    // A narrow context query may have no recording; broaden only within the same mood.
    if (!tracks.length && query && !fallback) {
      if (kind === 'music') tracks = await search(mood, undefined, 'music', true);
      else {
        const simplified = /slap/i.test(query) ? 'slap' : /punch|impact|hit/i.test(query) ? 'punch impact' : /stomp/i.test(query) ? 'foot stomp' : /running|footsteps?|walking/i.test(query) ? 'footsteps' : /swing|whoosh|swish/i.test(query) ? 'swing whoosh' : /rope|knot|tying/i.test(query) ? 'rope handling' : /splash/i.test(query) ? 'splashing footsteps' : /movement/i.test(query) ? 'crowd movement' : /rain|storm/i.test(query) ? 'rain' : /river|stream/i.test(query) ? 'river water' : /door/i.test(query) ? 'door' : /applause|clap|crowd/i.test(query) ? 'crowd applause' : undefined;
        if (simplified && simplified !== query) tracks = await search(mood, simplified, kind, true);
      }
    }
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { tracks, until: Date.now() + 3600000 });
    return tracks;
  };
}
function musicScore(item, query, mood) {
  const metadata = `${item.name} ${(item.tags ?? []).join(' ')}`.toLowerCase();
  const instruments = (query?.match(/\b(cello|piano|guitar|strings|orchestral|orchestra)\b/gi) ?? []).map(word => word === 'orchestral' ? 'orchestra' : word);
  const matching = instruments.filter(word => metadata.includes(word)).length;
  const feeling = { bright: /major|hopeful|warm|uplifting|bright/, tense: /suspense|tense|urgent|dramatic|action/, sad: /melanchol|sad|sorrow|emotional/, calm: /calm|gentle|peaceful|soft/ }[mood];
  return relevance(item, query) + matching * 5 + (feeling?.test(metadata) ? 3 : 0);
}
function relevance(item, query, environmentOnly = false) {
  const metadata = `${item.name} ${(item.tags ?? []).join(' ')}`.toLowerCase();
  const generic = new Set(['ambience', 'ambient', 'loop', 'field', 'recording', 'sound', 'sounds', 'soundscape', 'background', 'gentle', 'soft']);
  return (query?.toLowerCase().split(/\s+/) ?? []).filter(word => (!environmentOnly || !generic.has(word)) && metadata.includes(word)).length;
}
