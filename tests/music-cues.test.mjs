import test from 'node:test';
import assert from 'node:assert/strict';
import { CueMixer } from '../src/features/music/cue-playback.mjs';
import { normalizeMusicResult } from '../src/server/music-plan.mjs';

function setup() {
  let now = 0;
  const players = Array.from({ length: 4 }, () => ({ volume: 0, playing: false, isLoaded: false,
    pause() { this.playing = false; }, play() { this.playing = true; },
    replace(source) { this.source = source; this.isLoaded = false; this.playing = false; } }));
  const mixer = new CueMixer(players, () => {}, () => now);
  return { mixer, players, advance(ms = 200) { now += ms; players.forEach(p => { p.isLoaded = true; }); mixer.tick(); } };
}
const cue = (id, start, mode = 'once', end = start + 5) => ({ id, start, end, mode, gain: 0.4, selectedId: start,
  candidates: [{ id: start, audioUrl: `https://cdn.freesound.org/${id}.mp3` }] });

test('扉の音を先読みするが該当位置まで鳴らさず、一度だけ鳴らし、一時停止後に再発火しない', () => {
  const { mixer, players, advance } = setup(), door = cue('door', 10);
  mixer.update([door], 0, true, 0.5); advance();
  assert.equal(players[2].playing, false);
  mixer.update([door], 10, true, 0.5);
  assert.equal(players[2].playing, true); assert.equal(players[2].loop, false);
  assert.equal(mixer.hasEffects, true);
  mixer.update([door], 10, false, 0.5); advance(1000);
  mixer.update([door], 10, true, 0.5); advance();
  assert.equal(mixer.hasEffects, false); assert.equal(players[2].playing, false);
  mixer.update([door], 0, true, 0.5); advance();
  mixer.update([door], 10, true, 0.5);
  assert.equal(mixer.hasEffects, true);
});

test('雨と川は同時にループし、区間が終わった雨だけフェードアウトする', () => {
  const { mixer, players, advance } = setup();
  const rain = cue('rain', 0, 'loop', 20), river = cue('river', 1, 'loop', 50);
  mixer.update([rain, river], 2, true, 0.5); advance();
  assert.ok(players[0].playing && players[1].playing);
  assert.ok(players[0].loop && players[1].loop);
  mixer.update([rain, river], 25, true, 0.5);
  for (let i = 0; i < 30; i++) advance(80);
  const rainPlayer = players.find(p => p.source?.uri.includes('rain'));
  const riverPlayer = players.find(p => p.source?.uri.includes('river'));
  assert.equal(rainPlayer.playing, false); assert.equal(riverPlayer.playing, true);
  mixer.update([rain, river], 25, true, 0); assert.equal(riverPlayer.volume, 0);
});

test('大きくページ移動したとき過去の効果音をまとめて鳴らさず、読み込みが遅い音も遅れて鳴らさない', () => {
  const { mixer, players, advance } = setup(), door = cue('door', 10);
  mixer.update([door], 0, true, 0.5); advance();
  mixer.update([door], 500, true, 0.5); advance();
  assert.ok(players.every(p => !p.playing));
  mixer.update([door], 0, true, 0.5);
  mixer.update([door], 10, true, 0.5);
  advance(2500);
  assert.equal(mixer.hasEffects, false);
});

test('本文の実在する引用だけを文字位置に変換し、雨の持続と扉の一回再生を区別する', () => {
  const text = '😀扉を開けた。雨が降り始めた。';
  const result = normalizeMusicResult({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({
    scenes: [{ firstUnit: 0, label: '室内', reason: '静かな部屋', mood: 'calm', query: 'quiet room', kind: 'ambience' }],
    cues: [
      { unit: 0, quote: '扉を開けた', endUnit: 0, mode: 'once', label: '扉', query: 'wood door opening', gain: 0.3 },
      { unit: 0, quote: '雨が降り始めた', endUnit: 0, mode: 'loop', label: '雨', query: 'rain ambience', gain: 0.4 },
      { unit: 0, quote: '雷が鳴った', endUnit: 0, mode: 'once', label: '雷', query: 'thunder', gain: 0.3 },
    ],
  }) }] }] }, { text });
  assert.equal(result.cues.length, 2);
  assert.equal(result.cues[0].start, text.indexOf('扉'));
  assert.equal(result.cues[0].kind, 'effect');
  assert.equal(result.cues[1].kind, 'ambience');
  assert.equal(result.cues[1].end, text.length);
});
