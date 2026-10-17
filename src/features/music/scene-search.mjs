const textFor = scene => `${scene.label ?? ''} ${scene.query ?? ''}`.toLowerCase();

export function sceneTrackCompatible(scene, track) {
  if (!track || track.kind !== scene.kind) return false;
  const text = textFor(scene), name = `${track.name ?? ''} ${(track.tags ?? []).join(' ')}`.toLowerCase();
  if (scene.kind === 'ambience') {
    if (/village|rural|countryside|farm|村|田舎/.test(text) && /city|urban|traffic|subway/.test(name)) return false;
    if (/river|stream|川|濁流/.test(text) && !/river|stream|water|rapids|flood/.test(name)) return false;
    if (/rain|雨/.test(text) && !/rain|raindrop|shower|downpour/.test(name)) return false;
    if (/crowd|群衆|刑場/.test(text) && !/crowd|audience|people|murmur|cheer|market/.test(name)) return false;
    if (/village|rural|countryside|farm|村|田舎/.test(text) && !/village|rural|countryside|farm|country|forest|field|night|sheep|nature/.test(name)) return false;
  } else {
    if (/strings?|orchestra|orchestral/.test(text) && !/strings?|orchestra|orchestral|violin|cello/.test(name)) return false;
    if (/piano/.test(text) && !/piano/.test(name)) return false;
    if (/cello/.test(text) && !/cello/.test(name)) return false;
    if (/urgent|heroic|action/.test(text) && /peaceful|relaxation|lullaby/.test(name)) return false;
    if (/major key|hopeful|uplifting|friendship|bright/.test(text) && /lament|tragic|dark|mystery|horror/.test(name)) return false;
  }
  return true;
}

export function preferredSceneTrack(scene, tracks) {
  const compatible = tracks.filter(track => sceneTrackCompatible(scene, track));
  if (!compatible.length) return null;
  const words = textFor(scene).split(/[^a-z0-9]+/).filter(word => word.length > 2 && !new Set(['the', 'and', 'with', 'ambient', 'ambience', 'music', 'sound', 'quiet', 'gentle']).has(word));
  const score = track => {
    const name = `${track.name ?? ''} ${(track.tags ?? []).join(' ')}`.toLowerCase();
    const matches = words.filter(word => name.includes(word)).length;
    const mood = scene.mood;
    const moodMatch = mood === 'bright' ? /hope|hopeful|uplifting|major|warm|serenade/.test(name)
      : mood === 'sad' ? /sad|sorrow|melanch|emotional|tragic/.test(name)
        : mood === 'tense' ? /suspense|tense|urgent|dramatic|action/.test(name)
          : /calm|gentle|quiet|peaceful/.test(name);
    return matches + (moodMatch ? 1 : 0);
  };
  return compatible.reduce((best, track) => !best || score(track) > score(best) ? track : best, null);
}
