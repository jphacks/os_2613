import type { AudioPlayer } from 'expo-audio';
import type { MusicTrack } from '../../server/music.mjs';
import type { SoundCue } from './plan-model.mjs';
export class CueMixer {
  constructor(players: AudioPlayer[], onActive?: (tracks: MusicTrack[]) => void, now?: () => number, sourceFor?: (track: MusicTrack) => { uri: string });
  update(cues: SoundCue[], position: number, enabled: boolean, volume: number): void;
  tick(): void;
  stop(): void;
  arm(): void;
  readonly hasEffects: boolean;
  readonly ducking: number;
}
