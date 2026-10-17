export type ReviewBook = { id: string; title: string; author: string };
export type ReviewRecord = { $type: string; book: ReviewBook; displayName: string; rating: number; text: string; spoiler: boolean; createdAt: string; updatedAt: string };
export type Review = ReviewRecord & { did: string; uri: string; handle: string; avatar?: string };
export type ReviewStats = { count: number; average: number | null; histogram: number[] };
export const reviewCollection: string;
export const reviewScope: string;
export function validBookId(id: unknown): boolean;
export function reviewKey(bookId: string): string;
export function validateReview(value: unknown): ReviewRecord;
export function parseReviewUri(uri: string): { did: string; rkey: string };
export function latestReviews(items: Review[]): Review[];
export function reviewStats(items: Review[]): ReviewStats;
export function blueskyText(review: ReviewRecord, legacy?: boolean): string;

export function blueskyFacets(text: string): { index: { byteStart: number; byteEnd: number }; features: { $type: string; tag: string }[] }[];
