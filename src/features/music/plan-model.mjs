export const planVersion = 3;
export const bookTextLimit = 60000;
export function textUnits(text) {
  const units = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + 250, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf('\n', end);
      if (boundary > start + 100) end = boundary + 1;
      if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    }
    units.push({ id: units.length, start, end, text: text.slice(start, end) });
    start = end;
  }
  return units;
}
export function validTrack(track) {
  return track && Number.isInteger(track.id) && typeof track.name === 'string' && track.name.length <= 300 && typeof track.creator === 'string'
    && /^https:\/\/cdn\.freesound\.org\//.test(track.audioUrl) && /^https:\/\/freesound\.org\//.test(track.url)
    && /^https:\/\/creativecommons\.org\/(?:licenses\/by\/\d\.\d|publicdomain\/zero\/1\.0)\/?$/.test(track.license);
}
export function validateScenes(scenes, length) {
  if (!Array.isArray(scenes) || scenes.length < 1 || scenes.length > 32) throw new Error('INVALID_PLAN');
  let end = 0;
  for (const scene of scenes) {
    if (!scene || scene.start !== end || !Number.isInteger(scene.end) || scene.end <= end || scene.end > length
      || typeof scene.label !== 'string' || !scene.label.trim() || scene.label.length > 80
      || typeof scene.reason !== 'string' || scene.reason.length > 240
      || !['calm', 'tense', 'sad', 'bright'].includes(scene.mood)
      || (scene.kind !== undefined && !['ambience', 'music'].includes(scene.kind))
      || typeof scene.query !== 'string' || !/^[a-zA-Z0-9 -]{2,100}$/.test(scene.query)
      || !Array.isArray(scene.candidates) || scene.candidates.length > 3 || !scene.candidates.every(validTrack)
      || (scene.selectedId !== null && !scene.candidates.some(track => track.id === scene.selectedId))) throw new Error('INVALID_PLAN');
    end = scene.end;
  }
  if (end !== length) throw new Error('INVALID_PLAN');
  return scenes;
}
export function validateCues(cues, length) {
  if (!Array.isArray(cues) || cues.length > 48) throw new Error('INVALID_PLAN');
  const ids = new Set();
  for (const cue of cues) {
    if (!cue || typeof cue.id !== 'string' || ids.has(cue.id) || !Number.isInteger(cue.start) || !Number.isInteger(cue.end)
      || cue.start < 0 || cue.end <= cue.start || cue.end > length || !['once', 'loop'].includes(cue.mode)
      || !['effect', 'ambience'].includes(cue.kind) || typeof cue.label !== 'string' || cue.label.length > 80
      || !/^[a-zA-Z0-9 -]{2,100}$/.test(cue.query) || !Number.isFinite(cue.gain) || cue.gain < 0.1 || cue.gain > 0.8
      || !Array.isArray(cue.candidates) || cue.candidates.length > 3 || !cue.candidates.every(validTrack)
      || (cue.selectedId !== null && !cue.candidates.some(track => track.id === cue.selectedId))) throw new Error('INVALID_PLAN');
    ids.add(cue.id);
  }
  return cues;
}
