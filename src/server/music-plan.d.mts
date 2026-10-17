import type { MusicPlan } from '../features/music/plan-model.mjs';
export function createMusicPlanEndpoint(options?: object): (request: Request) => Promise<Response>;
export function bookInput(value: unknown): { title: string; text: string };
export function bookHash(text: string): string;
