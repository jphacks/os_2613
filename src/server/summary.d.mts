export function summaryInput(value: unknown): string;
export function summaryConfiguration(apiKey?: string): { configured: boolean };
export function createSummaryProvider(options?: { apiKey?: string; fetcher?: typeof fetch }): (text: string) => Promise<string>;
export function createSummaryEndpoint(options?: { provider?: (text: string) => Promise<string> }): (request: Request) => Promise<Response>;
