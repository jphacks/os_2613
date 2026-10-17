import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export function normalizeSamples(channels, sampleRate, kind) {
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > 2 || ![8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(sampleRate)
    || !channels[0].length || channels[0].length > sampleRate * 250 || channels.some(c => c.length !== channels[0].length)) throw new Error('AUDIO');
  const frame = Math.max(1, Math.round(sampleRate * 0.05)); let energy = 0, count = 0;
  for (let start = 0; start < channels[0].length; start += frame) {
    const end = Math.min(start + frame, channels[0].length); let sum = 0;
    for (const c of channels) for (let i = start; i < end; i++) { if (!Number.isFinite(c[i])) throw new Error('AUDIO'); sum += c[i] * c[i]; }
    const n = (end - start) * channels.length;
    if (sum / n > 1e-5) { energy += sum; count += n; }
  }
  if (!count) throw new Error('SILENT_AUDIO');
  const rms = Math.sqrt(energy / count), target = kind === 'effect' ? 0.18 : kind === 'ambience' ? 0.1 : 0.11;
  const gain = Math.min(8, target / rms);
  const pcm = channels.map(c => Int16Array.from(c, value => {
    const sample = value * gain, a = Math.abs(sample);
    const limited = a <= 0.85 ? a : 0.85 + 0.1 * Math.tanh((a - 0.85) / 0.1);
    return Math.round(Math.sign(sample) * limited * 32767);
  }));
  return { pcm, rms, gain };
}
async function convert(bytes, kind) {
  const [{ MPEGDecoder }, { Mp3Encoder }] = await Promise.all([import('mpg123-decoder'), import('@breezystack/lamejs')]);
  const decoder = new MPEGDecoder(); await decoder.ready;
  try {
    const decoded = decoder.decode(new Uint8Array(bytes));
    if (decoded.errors.length) throw new Error('AUDIO');
    const { pcm } = normalizeSamples(decoded.channelData, decoded.sampleRate, kind);
    const encoder = new Mp3Encoder(pcm.length, decoded.sampleRate, 128), output = [];
    for (let i = 0; i < pcm[0].length; i += 1152) output.push(Buffer.from(encoder.encodeBuffer(pcm[0].subarray(i, i + 1152), pcm[1]?.subarray(i, i + 1152))));
    output.push(Buffer.from(encoder.flush())); return Buffer.concat(output);
  } finally { decoder.free(); }
}
export function createMusicAudio({ root = resolve('.local/music-audio'), fetcher = fetch, processor = convert } = {}) {
  const pending = new Map();
  async function load(url, kind) {
    const key = createHash('sha256').update(`normalized-v1:${kind}:${url}`).digest('hex'), path = join(root, `${key}.mp3`);
    try { return await readFile(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!pending.has(key)) {
      if (pending.size >= 3) throw new Error('BUSY');
      const task = (async () => {
        const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
        if (!response.ok || Number(response.headers.get('content-length')) > 6000000) throw new Error('AUDIO');
        const chunks = []; let size = 0;
        for await (const chunk of response.body) { size += chunk.length; if (size > 6000000) throw new Error('AUDIO'); chunks.push(chunk); }
        const output = await processor(Buffer.concat(chunks), kind);
        await mkdir(root, { recursive: true }); const temp = `${path}.${randomUUID()}.tmp`;
        await writeFile(temp, output); await rename(temp, path); return output;
      })().finally(() => pending.delete(key)); pending.set(key, task);
    }
    return pending.get(key);
  }
  return async request => {
    const params = new URL(request.url).searchParams, url = params.get('url'), kind = params.get('kind') ?? 'music';
    if (!/^https:\/\/cdn\.freesound\.org\/previews\/[a-zA-Z0-9_./-]+\.mp3$/.test(url ?? '') || !['music', 'ambience', 'effect'].includes(kind)) return new Response(null, { status: 400 });
    try {
      const bytes = await load(url, kind), range = request.headers.get('range');
      const headers = { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (!match) return new Response(null, { status: 416 });
        const start = Number(match[1]), end = Math.min(bytes.length - 1, match[2] ? Number(match[2]) : bytes.length - 1);
        if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.length}` } });
        return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': String(end - start + 1) } });
      }
      return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Length': String(bytes.length) } });
    } catch (error) { return new Response(null, { status: error.message === 'BUSY' ? 429 : 503 }); }
  };
}
