const selectedTrack = cue => cue.candidates.find(track => track.id === cue.selectedId);

// Two environmental layers plus two non-looping effect voices.
export class CueMixer {
  constructor(players, onActive = () => {}, now = () => Date.now()) {
    this.players = players; this.onActive = onActive; this.now = now;
    this.slots = players.map(player => ({ player, cue: null, level: 0, triggered: null, started: null, at: 0 }));
    this.enabled = false; this.master = 0.25; this.previous = null; this.fired = new Set(); this.loops = []; this.activeKey = '';
  }
  stage(slot, cue) {
    const track = selectedTrack(cue);
    if (!track || slot.cue?.id === cue.id) return;
    slot.player.pause(); slot.player.volume = 0;
    slot.cue = cue; slot.level = 0; slot.triggered = null; slot.started = null; slot.at = this.now();
    slot.player.loop = cue.mode === 'loop'; slot.player.replace({ uri: track.audioUrl });
  }
  arm() {
    for (const slot of this.slots) {
      slot.player.volume = 0;
      if (slot.player.isLoaded) { try { slot.player.play(); } catch { /* Actual playback resumes with the guide. */ } }
    }
  }
  stop() {
    this.enabled = false; this.players.forEach(player => player.pause());
    this.clearEffects(); this.publish();
  }
  clearEffects() {
    for (const slot of this.slots.slice(2)) {
      if (slot.triggered === null && slot.started === null) continue;
      slot.player.pause(); slot.player.volume = 0;
      slot.cue = null; slot.triggered = null; slot.started = null;
    }
  }
  update(cues, position, enabled, master) {
    const previous = this.previous;
    const seek = previous !== null && (position < previous || position - previous > 120);
    if (seek) {
      for (const cue of cues) if (cue.start >= position) this.fired.delete(cue.id);
      for (const slot of this.slots.slice(2)) { slot.player.pause(); slot.cue = null; slot.triggered = null; slot.started = null; }
    }
    if (!enabled) this.clearEffects();
    this.master = master; this.enabled = enabled; this.previous = position;
    this.loops = cues.filter(cue => cue.mode === 'loop' && cue.start <= position && position < cue.end && selectedTrack(cue)).sort((a, b) => b.start - a.start).slice(0, 2);
    this.assignLoops();
    const once = cues.filter(cue => cue.mode === 'once' && selectedTrack(cue));
    const due = enabled ? once.filter(cue => !this.fired.has(cue.id) && (cue.start === position || (!seek && previous !== null && previous < cue.start && cue.start <= position))) : [];
    for (const cue of due) {
      this.fired.add(cue.id);
      const slot = this.slots.slice(2).find(slot => slot.cue?.id === cue.id) ?? this.slots.slice(2).find(slot => slot.started === null && slot.triggered === null);
      if (!slot) continue;
      this.stage(slot, cue); slot.triggered = this.now();
    }
    // Preload only the next two nearby effects, without triggering them early.
    for (const cue of once.filter(cue => cue.start >= position && cue.start - position <= 120 && !this.fired.has(cue.id)).slice(0, 2)) {
      if (this.slots.some(slot => slot.cue?.id === cue.id)) continue;
      const slot = this.slots.slice(2).find(slot => slot.triggered === null && slot.started === null && (!slot.cue || slot.cue.start < position));
      if (slot) this.stage(slot, cue);
    }
    this.tick();
  }
  assignLoops() {
    for (const cue of this.loops) {
      if (this.slots.slice(0, 2).some(slot => slot.cue?.id === cue.id)) continue;
      const slot = this.slots.slice(0, 2).find(slot => !slot.cue);
      if (slot) this.stage(slot, cue);
    }
  }
  tick() {
    if (!this.enabled) { this.players.forEach(player => { player.volume = 0; player.pause(); }); this.publish(); return; }
    const now = this.now();
    this.assignLoops();
    this.slots.forEach((slot, index) => {
      const { player, cue } = slot;
      if (!cue) return;
      if (index < 2) {
        const target = this.loops.some(item => item.id === cue.id) ? cue.gain : 0;
        slot.level += (target - slot.level) * 0.25;
        player.volume = this.master * slot.level * 0.6;
        if (target && player.isLoaded && !player.isBuffering && !player.playing && now - slot.at > 150) { try { player.play(); } catch {} }
        if (!target && slot.level < 0.005) { player.pause(); slot.cue = null; slot.level = 0; }
      } else if (slot.triggered !== null) {
        if (slot.started === null) {
          if (now - slot.triggered > 2000) { player.pause(); slot.cue = null; slot.triggered = null; return; }
          if (player.isLoaded && !player.isBuffering && now - slot.at > 150) {
            player.loop = false; player.volume = this.master * cue.gain * 0.8;
            try { player.play(); } catch {}
            if (player.playing) slot.started = now;
          }
        } else {
          const elapsed = now - slot.started;
          player.volume = this.master * cue.gain * 0.8 * Math.max(0, Math.min(1, (10000 - elapsed) / 300));
          if (elapsed > 10000 || (!player.playing && elapsed > 200)) { player.pause(); slot.cue = null; slot.triggered = null; slot.started = null; }
        }
      }
    });
    this.publish();
  }
  get hasEffects() { return this.enabled && this.slots.slice(2).some(slot => slot.started !== null && slot.player.playing); }
  publish() {
    const active = this.enabled ? this.slots.filter(slot => slot.cue && slot.player.playing && slot.player.volume > 0.001).map(slot => selectedTrack(slot.cue)) : [];
    const key = active.map(track => track.id).join(',');
    if (key !== this.activeKey) { this.activeKey = key; this.onActive(active); }
  }
}
