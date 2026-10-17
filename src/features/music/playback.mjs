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

// Two looped players: keep the outgoing track until the incoming track plays.
export class ContinuousMixer {
  constructor(players, fallback, notify = () => {}, now = () => Date.now()) {
    this.players = players; this.fallback = fallback; this.notify = notify; this.now = now;
    this.active = 0; this.volume = 0.25; this.enabled = false;
    this.duck = 1;
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
  setDucking(value) { if (this.duck !== value) { this.duck = value; this.apply(); } }
  request(id, source) {
    if (id === this.desired) return;
    this.desired = id;
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
    const t = this.pending?.fade === null || !this.pending ? 0 : Math.min(1, (this.now() - this.pending.fade) / 2000);
    const level = this.volume * (this.players[2] ? 0.8 : 1) * this.duck;
    this.players[this.active].volume = level * Math.cos(t * Math.PI / 2);
    this.players[1 - this.active].volume = level * Math.sin(t * Math.PI / 2);
    if (this.players[2]) this.players[2].volume = this.volume * 0.2;
  }
  tick() {
    if (!this.enabled) return;
    const time = this.now(), active = this.players[this.active];
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
    const incoming = this.players[pending.index];
    if (time - pending.at > 15000) {
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
    if (time - pending.fade >= 2000) {
      active.pause(); active.volume = 0;
      this.active = pending.index; this.current = pending.id; this.pending = null; this.apply();
    }
  }
}
