import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeSamples, createMusicAudio } from '../src/server/music-audio.mjs';
import { Mp3Encoder } from '@breezystack/lamejs';
import { MPEGDecoder } from 'mpg123-decoder';

const tone = amplitude => Float32Array.from({ length: 22050 }, (_, i) => amplitude * Math.sin(i * 440 * 2 * Math.PI / 22050));
const rms = a => Math.sqrt(a.reduce((sum, v) => sum + (v / 32767) ** 2, 0) / a.length);
test('元の録音が小さくても大きくても音量を揃え、効果音を明瞭にしピークを抑える', () => {
  const quiet = normalizeSamples([tone(0.02)], 22050, 'music'), loud = normalizeSamples([tone(0.5)], 22050, 'music');
  assert.ok(Math.abs(rms(quiet.pcm[0]) - rms(loud.pcm[0])) < 0.005);
  assert.ok(rms(normalizeSamples([tone(0.5)], 22050, 'effect').pcm[0]) > rms(loud.pcm[0]));
  for (const value of normalizeSamples([Float32Array.from([0.01, 0.01, 10])], 22050, 'effect').pcm[0]) assert.ok(Math.abs(value) <= 31130);
  assert.throws(() => normalizeSamples([new Float32Array(100)], 22050, 'music'), /SILENT_AUDIO/);
});
test('MP3を実際に読み書きして音量を補正し、保存・Range再生・外部URL拒否に対応する', async t => {
  const root = await mkdtemp(join(tmpdir(), 'music-audio-')); t.after(() => rm(root, { recursive: true, force: true }));
  const encoder = new Mp3Encoder(1, 22050, 128), samples = Int16Array.from(tone(0.02), v => v * 32767), chunks = [];
  for (let i = 0; i < samples.length; i += 1152) chunks.push(Buffer.from(encoder.encodeBuffer(samples.subarray(i, i + 1152))));
  chunks.push(Buffer.from(encoder.flush())); const original = Buffer.concat(chunks); let calls = 0;
  const endpoint = createMusicAudio({ root, fetcher: async () => { calls++; return new Response(original); } });
  const url = 'http://app.test/api/music-audio?url=https%3A%2F%2Fcdn.freesound.org%2Fpreviews%2F1%2Ftest.mp3&kind=music';
  const response = await endpoint(new Request(url)); assert.equal(response.status, 200);
  const decoder = new MPEGDecoder(); await decoder.ready;
  try { const decoded = decoder.decode(new Uint8Array(await response.arrayBuffer())); assert.ok(decoded.samplesDecoded > 1000); assert.ok(Math.max(...decoded.channelData[0]) > 0.1); } finally { decoder.free(); }
  const range = await endpoint(new Request(url, { headers: { Range: 'bytes=0-1' } })); assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 2); assert.equal(calls, 1);
  assert.equal((await endpoint(new Request('http://app.test/api/music-audio?url=https://evil.test/1.mp3'))).status, 400);
});
