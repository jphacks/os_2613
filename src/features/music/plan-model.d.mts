import type { MusicTrack } from '../../server/music.mjs';
export type MusicScene = { start: number; end: number; label: string; reason: string; mood: 'calm' | 'tense' | 'sad' | 'bright'; query: string; candidates: MusicTrack[]; selectedId: number | null };
export type MusicPlan = { version: number; hash: string; title: string; revision: string; scenes: MusicScene[]; usage: { input: number; output: number; total: number } };
export const planVersion: number;
export const bookTextLimit: number;
export function textUnits(text: string): { id: number; start: number; end: number; text: string }[];
export function validTrack(track: unknown): boolean;
export function validateScenes(scenes: unknown, length: number): MusicScene[];
