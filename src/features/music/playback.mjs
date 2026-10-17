// Select only from the current or earlier scenes; never borrow future music.
export function musicAt(scenes, offset) {
  const index = scenes.findIndex(scene => offset >= scene.start && offset < scene.end);
  if (index < 0) return null;
  for (let i = index; i >= 0; i--) {
    const track = scenes[i].candidates.find(item => item.id === scenes[i].selectedId);
    if (track) return track;
  }
  return null;
}
export function sceneIntensity(scene) {
  if (!scene) return 1;
  const gain = { calm: 0.84, sad: 0.92, bright: 1, tense: 1.12 }[scene.mood] ?? 1;
  return gain * (scene.kind === 'ambience' ? 0.95 : 1);
}
const fadeDuration = 3200;

// Two looped players: keep the outgoing track until the incoming track plays.
export class ContinuousMixer {
  constructor(players, fallback, notify = () => {}, now = () => Date.now()) {
    this.players = players; this.fallback = fallback; this.notify = notify; this.now = now;
    this.active = 0; this.volume = 0.25; this.enabled = false;
    this.duck = 1;
    this.duckTarget = 1; this.intensity = 1; this.intensityTarget = 1; this.lastTick = this.now(); this.queued = null;
    this.current = 'fallback'; this.desired = 'fallback'; this.pending = null; this.stalledAt = null;
    players.forEach(player => { player.loop = true; player.volume = 0; });
  }
  start() { this.enabled = true; if (this.pending) { this.pending.at = this.now(); this.pending.fade = null; } this.tick(); }
  arm() {
    this.enabled = false;
    for (const player of this.players) {
      player.volume = 0;
      if (player.isLoaded) { try { player.play(); } catch { this.notify('BGMをOFFにしてからONにしてください。'); } }
    }
  }
  stop() { this.enabled = false; this.players.forEach(player => player.pause()); }
  setVolume(value) { this.volume = Math.max(0, Math.min(1, value)); this.apply(); }
  setDucking(value) { this.duckTarget = Math.max(0, Math.min(1, value)); }
  setIntensity(value) { this.intensityTarget = Math.max(0.3, Math.min(1.2, value)); }
  preload(id, source) {
    if (id === this.current || this.pending) return;
    const index = 1 - this.active, player = this.players[index];
    try {
      player.pause(); player.volume = 0; player.loop = true; player.replace(source);
      this.pending = { id, index, at: this.now(), fade: null, staged: true };
    } catch { /* Retry at the scene boundary while the current track continues. */ }
  }
  request(id, source) {
    if (id === this.desired) { this.queued = null; return; }
    // Finish an audible crossfade before replacing either voice.
    if (this.pending?.fade !== null && this.pending?.fade !== undefined) { this.queued = { id, source }; return; }
    this.desired = id;
    if (this.pending?.id === id) { this.pending.staged = false; this.pending.at = this.now(); return; }
    if (this.pending) this.players[this.pending.index].pause();
    this.pending = null;
    if (id === this.current) { this.apply(); return; }
    const index = 1 - this.active, player = this.players[index];
    try {
      player.pause(); player.volume = 0; player.loop = true; player.replace(source);
      this.pending = { id, index, at: this.now(), fade: null };
    } catch { this.notify('曲を読み込めないため、現在のBGMを続けます。'); }
    this.apply();
  }
  apply() {
    if (!this.enabled) { this.players.forEach(player => { player.volume = 0; }); return; }
    const t = this.pending?.fade === null || !this.pending ? 0 : Math.min(1, (this.now() - this.pending.fade) / fadeDuration);
    const level = Math.min(1, this.volume * (this.players[2] ? 0.55 : 0.68) * this.duck * this.intensity);
    this.players[this.active].volume = level * Math.cos(t * Math.PI / 2);
    this.players[1 - this.active].volume = level * Math.sin(t * Math.PI / 2);
    if (this.players[2]) this.players[2].volume = Math.min(1, this.volume * (this.players[this.active].isBuffering ? 0.25 : 0.1) * this.duck * this.intensity);
  }
  tick() {
    if (!this.enabled) return;
    const time = this.now(), active = this.players[this.active];
    const elapsed = Math.max(0, Math.min(500, time - this.lastTick)); this.lastTick = time;
    this.duck += (this.duckTarget - this.duck) * (1 - Math.exp(-elapsed / (this.duckTarget < this.duck ? 120 : 1000)));
    this.intensity += (this.intensityTarget - this.intensity) * (1 - Math.exp(-elapsed / 1200));
    const bed = this.players[2];
    if (bed?.isLoaded && !bed.playing) { try { bed.play(); } catch { /* User can retry BGM start. */ } }
    if (active.isLoaded && !active.playing && !active.isBuffering) {
      try { active.play(); } catch { this.notify('再生ボタンを押して音声を許可してください。'); }
    }
    if (active.isBuffering) {
      this.stalledAt ??= time;
      if (time - this.stalledAt > 2000 && !this.pending && this.current !== 'fallback') {
        this.notify('通信待ちのため予備BGMへ切り替えます。'); this.request('fallback', this.fallback);
      }
    } else this.stalledAt = null;
    const pending = this.pending;
    if (!pending) { this.apply(); return; }
    if (pending.staged) { this.apply(); return; }
    const incoming = this.players[pending.index];
    if (pending.fade === null && time - pending.at > 15000) {
      incoming.pause(); this.pending = null; this.apply();
      this.notify('次の曲を読み込めないため、現在のBGMを続けます。'); return;
    }
    if (time - pending.at < 150) return;
    if (incoming.isLoaded && !incoming.isBuffering && !incoming.playing) {
      try { incoming.play(); } catch { /* Keep outgoing audio on autoplay rejection. */ }
    }
    if (!incoming.playing || incoming.isBuffering) { pending.fade = null; this.apply(); return; }
    pending.fade ??= time;
    this.apply();
    if (time - pending.fade >= fadeDuration) {
      active.pause(); active.volume = 0;
      this.active = pending.index; this.current = pending.id; this.pending = null; this.apply();
      if (this.queued) { const queued = this.queued; this.queued = null; this.request(queued.id, queued.source); }
    }
  }
}
