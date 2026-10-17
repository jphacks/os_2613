import type { MusicTrack } from '../../server/music.mjs';
export function audioSource(track: MusicTrack, origin?: string): { uri: string };
