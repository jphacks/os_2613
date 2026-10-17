export function audioSource(track, origin = '') {
  return { uri: `${origin}/api/music-audio?${new URLSearchParams({ url: track.audioUrl, kind: track.kind ?? 'music' })}` };
}
