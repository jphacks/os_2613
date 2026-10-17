export type ReviewNotice = { message: string; blueskyUrl?: string };
let notice: ReviewNotice | null = null;
export function setReviewNotice(message: string, blueskyUrl?: string) { notice = { message, blueskyUrl }; }
export function takeReviewNotice() { const value = notice; notice = null; return value; }
