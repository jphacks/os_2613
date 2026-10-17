import { createSummaryEndpoint, summaryConfiguration } from '../../server/summary.mjs';

const summary = createSummaryEndpoint();
export async function POST(request: Request) { return summary(request); }
// キーを返さず、有料生成なしで設定の有無だけを確認する。
export function GET() { return Response.json(summaryConfiguration(), { headers: { 'Cache-Control': 'no-store' } }); }
