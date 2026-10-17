import type { MusicTrack } from '../../server/music.mjs';
import type { MusicScene } from './plan-model.mjs';
import type { AudioPlayer, AudioSource } from 'expo-audio';
export function musicAt(scenes: MusicScene[], offset: number): MusicTrack | null;
export function sceneIntensity(scene?: MusicScene): number;
export class ContinuousMixer {
  constructor(players: AudioPlayer[], fallback: AudioSource, notify?: (message: string) => void, now?: () => number);
  start(): void;
  arm(): void;
  stop(): void;
  setVolume(value: number): void;
  setDucking(value: number): void;
  setIntensity(value: number): void;
  preload(id: string, source: AudioSource): void;
  request(id: string, source: AudioSource): void;
  tick(): void;
}
