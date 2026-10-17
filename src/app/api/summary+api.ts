import { createSummaryEndpoint } from '../../server/summary.mjs';

const summary = createSummaryEndpoint();
export async function POST(request: Request) { return summary(request); }
