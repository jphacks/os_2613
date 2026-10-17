import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ContinuousMixer, musicAt, sceneIntensity } from '../src/features/music/playback.mjs';

function player() {
  return { volume: 0, loop: false, isLoaded: true, playing: false, isBuffering: false, play() { this.playing = true; }, pause() { this.playing = false; }, replace(source) { this.source = source; this.isLoaded = false; this.playing = false; } };
}

test('次の曲は先に読み込むだけで鳴らさず、境界に達してから切り替える', () => {
  let now = 0;
  const a = player(), b = player(), mixer = new ContinuousMixer([a, b], 'pad', () => {}, () => now);
  mixer.start(); mixer.preload('next', 'next-source'); b.isLoaded = true;
  now = 20000; mixer.tick(); assert.equal(b.playing, false); assert.equal(a.volume, 0.25);
  mixer.request('next', 'next-source'); now += 200; mixer.tick(); assert.equal(b.playing, true);
  now += 3200; mixer.tick(); assert.equal(a.playing, false); assert.equal(b.volume, 0.25);
});

test('切替途中で別の曲が要求されても、鳴っている曲を突然停止しない', () => {
  let now = 0;
  const a = player(), b = player(), mixer = new ContinuousMixer([a, b], 'pad', () => {}, () => now);
  mixer.start(); mixer.request('one', 'one'); b.isLoaded = true;
  now = 200; mixer.tick(); now = 1800; mixer.tick();
  const level = b.volume; mixer.request('two', 'two');
  assert.equal(b.playing, true); assert.equal(b.volume, level);
  now = 3400; mixer.tick(); assert.equal(b.playing, true); assert.equal(b.volume, 0.25);
  assert.equal(a.source, 'two');
});

test('強弱と背景の抑制は滑らかに変わり、音量上限とミュートを守る', () => {
  let now = 0;
  const a = player(), b = player(), bed = player(), mixer = new ContinuousMixer([a, b, bed], 'pad', () => {}, () => now);
  assert.ok(sceneIntensity({ mood: 'tense', kind: 'music' }) > sceneIntensity({ mood: 'calm', kind: 'music' }));
  mixer.start(); const before = a.volume; mixer.setDucking(0.22);
  assert.equal(a.volume, before);
  now += 80; mixer.tick(); assert.ok(a.volume < before && a.volume > before * 0.22);
  mixer.setIntensity(1.2); mixer.setVolume(1);
  for (let i = 0; i < 100; i++) { now += 80; mixer.tick(); assert.ok(a.volume <= 1 && bed.volume <= 1); }
  mixer.setVolume(0); assert.equal(a.volume, 0); assert.equal(bed.volume, 0);
});
test('読んだ位置で切り替え、曲がない場面でも未来の曲を先取りしない', () => {
  const scenes = [{ start: 0, end: 10, selectedId: null, candidates: [] }, { start: 10, end: 20, selectedId: 1, candidates: [{ id: 1 }] }, { start: 20, end: 30, selectedId: null, candidates: [] }, { start: 30, end: 40, selectedId: 2, candidates: [{ id: 2 }] }];
  assert.equal(musicAt(scenes, 0), null);
  assert.equal(musicAt(scenes, 10).id, 1);
  assert.equal(musicAt(scenes, 29).id, 1);
  assert.equal(musicAt(scenes, 30).id, 2);
  assert.equal(musicAt(scenes, 9), null);
});
test('次の曲が読み込まれるまでは旧曲を維持し、3.2秒間重ねて切り替える', () => {
  let now = 0;
  const a = player(), b = player(), mixer = new ContinuousMixer([a, b], 'pad', () => {}, () => now);
  mixer.setVolume(0.4); mixer.start(); assert.ok(a.playing); assert.equal(a.volume, 0.4);
  mixer.request('music', 'remote'); now = 1000; mixer.tick();
  assert.ok(a.playing); assert.equal(a.volume, 0.4); assert.equal(b.playing, false);
  b.isLoaded = true; mixer.tick(); assert.ok(b.playing);
  now = 2000; mixer.tick(); assert.ok(a.volume > 0 && b.volume > 0);
  assert.ok(Math.abs(a.volume ** 2 + b.volume ** 2 - 0.16) < 0.00001);
  now = 4200; mixer.tick(); assert.equal(a.playing, false); assert.ok(b.playing); assert.equal(b.volume, 0.4);
  mixer.setVolume(0.1); assert.equal(b.volume, 0.1);
  mixer.stop(); assert.ok(!a.playing && !b.playing);
});
test('取得失敗・バッファリング・場面の早い移動で旧曲を不用意に停止しない', () => {
  let now = 0;
  const a = player(), b = player(), notices = [], mixer = new ContinuousMixer([a, b], 'pad', text => notices.push(text), () => now);
  mixer.start(); mixer.request('bad', 'broken'); now = 16000; mixer.tick();
  assert.ok(a.playing); assert.equal(a.volume, 0.25); assert.ok(notices.length);
  mixer.request('other', 'other'); b.isLoaded = true; b.isBuffering = true; now = 17000; mixer.tick();
  assert.equal(a.volume, 0.25); assert.ok(a.playing);
  mixer.request('fallback', 'pad'); assert.ok(a.playing); assert.equal(a.volume, 0.25);
});
test('同梱の予備BGMは有効なPCM音声であり、無音ファイルではない', async () => {
  const wav = await readFile(new URL('../assets/audio/reading-pad.wav', import.meta.url));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  let energy = 0;
  for (let i = 44; i < wav.length; i += 2) energy += wav.readInt16LE(i) ** 2;
  assert.ok(energy > 1000000); assert.ok(wav.length < 600000);
});
test('取得曲の通信が止まってもローカルの背景パッドは続き、音量バーが両方に作用する', () => {
  let now = 0;
  const a = player(), b = player(), bed = player(), mixer = new ContinuousMixer([a, b, bed], 'pad', () => {}, () => now);
  mixer.setVolume(0.5); mixer.start();
  assert.ok(bed.playing); assert.equal(bed.volume, 0.1);
  a.isBuffering = true; now = 1000; mixer.tick(); assert.ok(bed.playing); assert.ok(bed.volume > 0);
  mixer.setVolume(0); assert.equal(a.volume, 0); assert.equal(bed.volume, 0);
  mixer.stop(); assert.equal(bed.playing, false);
});
test('BGM ONでは無音で準備し、ガイド開始で鳴り、一時停止後も同じ曲を再開できる', () => {
  const a = player(), b = player(), bed = player(), mixer = new ContinuousMixer([a, b, bed], 'pad');
  mixer.arm(); assert.ok(a.playing); assert.equal(a.volume, 0); assert.equal(bed.volume, 0);
  mixer.setVolume(0.5); mixer.tick(); assert.equal(a.volume, 0); assert.equal(bed.volume, 0);
  mixer.start(); assert.ok(a.playing); assert.equal(a.volume, 0.4); assert.equal(bed.volume, 0.1);
  mixer.stop(); assert.equal(a.playing, false); assert.equal(bed.playing, false);
  mixer.start(); assert.ok(a.playing); assert.equal(a.volume, 0.4);
});
