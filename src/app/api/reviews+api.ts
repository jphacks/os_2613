import { createReviewsEndpoint } from '@/server/reviews.mjs';
const endpoint = createReviewsEndpoint();
export const GET = endpoint;
export const POST = endpoint;
