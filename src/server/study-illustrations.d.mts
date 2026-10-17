import type { StudyVisual } from '../features/study/visuals.mjs';
export type IllustrationInput = { id: string; hash: string; unit: number; level: 'beginner' | 'standard'; source: string; lesson: string };
export function createStudyIllustrations(options?: unknown): { read(input: IllustrationInput): Promise<{ complete: boolean; visuals: StudyVisual[] }>; generate(input: IllustrationInput): Promise<unknown>; image(request: Request): Promise<Response> };
