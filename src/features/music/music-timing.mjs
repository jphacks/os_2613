import { textUnits } from './plan-model.mjs';

function topic(value) {
  const text = `${value.label ?? ''} ${value.query ?? ''}`.toLowerCase();
  if (/rain|rainfall|雨/.test(text)) return 'rain';
  if (/river|stream|rapids|川|濁流|小川/.test(text)) return 'river';
  if (/crowd|audience|群衆|人波|刑場/.test(text)) return 'crowd';
  if (/running|footstep|疾走|走る|駆け/.test(text)) return 'running';
  return null;
}

// Old shared plans start scenes at paragraph boundaries. Delay those transitions
// to explicit environmental cues or to the end of that text unit, avoiding spoilers.
export function anchorLegacyScenes(plan, text) {
  if (plan.timingVersion >= 2) return plan;
  const units = textUnits(text), scenes = plan.scenes;
  let anchored = scenes.map((scene, index) => {
    const nextStart = scenes[index + 1]?.start ?? text.length;
    const sceneTopic = scene.kind === 'ambience' ? topic(scene) : null;
    const matchingCue = sceneTopic && (plan.cues ?? []).filter(cue => cue.start >= scene.start && cue.start < scene.end && topic(cue) === sceneTopic)
      .sort((a, b) => a.start - b.start)[0];
    const unit = units.find(item => item.start <= scene.start && scene.start < item.end);
    const start = matchingCue?.start ?? (unit ? Math.min(unit.end, text.length - 1) : scene.start);
    return { ...scene, start, _drop: start >= nextStart || start >= text.length };
  }).filter(scene => !scene._drop);
  if (!anchored.length) anchored = [{ ...scenes[0], start: 0, kind: 'music', label: '本文の導入', reason: '本文に場面の根拠が現れるまでは控えめな導入音を使う。', mood: 'calm', query: 'gentle ambient music', candidates: [], selectedId: null }];
  if (anchored.length && anchored[0].start > 0) anchored = [{ ...scenes[0], start: 0, kind: 'music', label: '本文の導入', reason: '本文に場面の根拠が現れるまでは控えめな導入音を使う。', mood: 'calm', query: 'gentle ambient music', candidates: [], selectedId: null }, ...anchored].slice(0, 32);
  return { ...plan, timingVersion: 2, scenes: anchored.map((scene, index) => ({
    kind: scene.kind, start: scene.start, end: anchored[index + 1]?.start ?? text.length,
    label: scene.label, reason: scene.reason, mood: scene.mood, query: scene.query,
    candidates: scene.candidates, selectedId: scene.selectedId,
  })) };
}
