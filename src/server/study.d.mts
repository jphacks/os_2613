import type { StudyVisual } from '../features/study/visuals.mjs';
export type Lesson = { title: string; sourceQuote: string; beginner: string; standard: string; beginnerVisuals?: StudyVisual[]; standardVisuals?: StudyVisual[]; illustrationsComplete?: { beginner?: boolean; standard?: boolean } };
export type StudyState = { id: string; hash: string;
  chapters: { index: number; title: string; firstPage: number; lastPage: number; units: number[]; complete: boolean; baseComplete: boolean; enhanced: boolean; needsVisuals: boolean; remainingRequests: number }[];
  units: { index: number; chapter: number; part: number; firstPage: number; lastPage: number; title: string; lesson: Lesson | null; error: string | null }[] };
export function createStudyEndpoint(options?: unknown): (request: Request) => Promise<Response>;
